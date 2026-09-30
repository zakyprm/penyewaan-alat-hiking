import "server-only";
import { DomainError } from "@/lib/domain/errors";
import { assertGuaranteeAllowed } from "@/lib/domain/guarantee";
import { formatOrderCode, orderCodeDay } from "@/lib/domain/order-code";
import { quote, rentalDays } from "@/lib/domain/pricing";
import { computePaymentDueAt, validateRentalWindow } from "@/lib/domain/schedule";
import type { GuaranteeType, OrderSource, OrderStatus, PaymentMethod } from "@/lib/domain/types";
import { db } from "../db";
import { reservedUnits, type DbClient } from "./availability";
import { getSettings } from "./settings";

export interface CreateOrderInput {
  source: OrderSource;
  /** null untuk tamu walk-in tanpa akun */
  userId: string | null;
  customerName: string;
  customerPhone: string;
  items: { itemId: string; quantity: number }[];
  startAt: Date;
  endAt: Date;
  guaranteeType: GuaranteeType;
  paymentMethod: PaymentMethod;
  note?: string;
  /** Admin pembuat (walk-in); juga dicatat sebagai pelaku event */
  createdById?: string | null;
  /** Waktu acuan, bisa diisi di test */
  now?: Date;
}

export interface CreatedOrder {
  id: string;
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  guaranteeType: GuaranteeType;
  startAt: Date;
  endAt: Date;
  rentalDays: number;
  rentalSubtotal: number;
  depositTotal: number;
  totalDue: number;
  paymentDueAt: Date | null;
  items: { itemId: string; itemName: string; quantity: number; pricePerDay: number; lineTotal: number }[];
}

export interface StockShortage {
  itemId: string;
  name: string;
  requested: number;
  available: number;
}

/** Nomor urut harian atomik: aman walau banyak pesanan dibuat bersamaan. */
async function nextOrderCode(tx: DbClient, now: Date): Promise<string> {
  const day = orderCodeDay(now);
  const [row] = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "OrderCodeCounter" ("day", "value") VALUES (${day}, 1)
    ON CONFLICT ("day") DO UPDATE SET "value" = "OrderCodeCounter"."value" + 1
    RETURNING "value"`;
  return formatOrderCode(day, Number(row.value));
}

/**
 * Buat pesanan (design 5.5). Seluruh proses berada dalam satu transaksi:
 * 1. Kunci baris alat (`FOR UPDATE`, urutan id tetap untuk mencegah deadlock).
 * 2. Hitung ulang ketersediaan di server (Req 5.5).
 * 3. Simpan pesanan beserta snapshot harga dan kebijakan (Req 6.5, 10.5).
 * Transaksi lain untuk alat yang sama menunggu kunci dilepas, lalu melihat pesanan ini,
 * sehingga unit terakhir tidak bisa dipesan dua kali (Req 5.4).
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const now = input.now ?? new Date();
  const settings = await getSettings();

  validateRentalWindow({ startAt: input.startAt, endAt: input.endAt, now, source: input.source, hours: settings });

  const quantities = new Map<string, number>();
  for (const line of input.items) quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
  const itemIds = [...quantities.keys()].sort();
  if (itemIds.length === 0) throw new DomainError("VALIDASI_GAGAL", "Pilih minimal satu alat.");

  const days = rentalDays(input.startAt, input.endAt);

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ANY(${itemIds}) ORDER BY "id" FOR UPDATE`;

      const items = await tx.item.findMany({ where: { id: { in: itemIds }, deletedAt: null, isActive: true } });
      // Pesanan online hanya boleh berisi alat publik (Req 3.5); alat internal dianggap tidak ada
      const usable = items.filter((i) => input.source === "WALK_IN" || i.visibility === "PUBLIC");
      const missing = itemIds.filter((id) => !usable.some((i) => i.id === id));
      if (missing.length > 0) {
        throw new DomainError("TIDAK_DITEMUKAN", "Sebagian alat tidak tersedia untuk disewa.", { itemIds: missing });
      }
      const byId = new Map(usable.map((i) => [i.id, i]));

      assertGuaranteeAllowed(input.guaranteeType, usable, settings);

      const reserved = await reservedUnits(tx, itemIds, { start: input.startAt, end: input.endAt }, now);
      const shortages: StockShortage[] = [];
      for (const id of itemIds) {
        const available = Math.max(0, byId.get(id)!.stock - (reserved.get(id) ?? 0));
        if (quantities.get(id)! > available) {
          shortages.push({ itemId: id, name: byId.get(id)!.name, requested: quantities.get(id)!, available });
        }
      }
      if (shortages.length > 0) {
        const names = shortages.map((s) => `${s.name} (tersisa ${s.available})`).join(", ");
        throw new DomainError("STOK_TIDAK_CUKUP", `Stok tidak cukup pada waktu yang dipilih: ${names}.`, shortages);
      }

      const priced = quote(
        itemIds.map((id) => {
          const item = byId.get(id)!;
          return {
            itemId: id,
            itemName: item.name,
            pricePerDay: item.pricePerDay,
            depositPerUnit: item.depositPerUnit,
            quantity: quantities.get(id)!,
          };
        }),
        days,
        input.guaranteeType,
      );

      // Online + bayar online menunggu Midtrans; bayar di toko dan walk-in langsung dikonfirmasi (Req 8.2, 8.6)
      const status: OrderStatus =
        input.source === "ONLINE" && input.paymentMethod === "ONLINE" ? "MENUNGGU_PEMBAYARAN" : "DIKONFIRMASI";
      const paymentDueAt = computePaymentDueAt({
        source: input.source,
        method: input.paymentMethod,
        createdAt: now,
        startAt: input.startAt,
        onlinePaymentExpiryMin: settings.onlinePaymentExpiryMin,
        payAtStoreCancelHours: settings.payAtStoreCancelHours,
      });
      const code = await nextOrderCode(tx, now);

      const order = await tx.order.create({
        data: {
          code,
          source: input.source,
          userId: input.userId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          startAt: input.startAt,
          endAt: input.endAt,
          rentalDays: days,
          status,
          paymentMethod: input.paymentMethod,
          guaranteeType: input.guaranteeType,
          rentalSubtotal: priced.rentalSubtotal,
          depositTotal: priced.depositTotal,
          graceHours: settings.graceHours,
          lateFinePercent: settings.lateFinePercent,
          paymentDueAt,
          note: input.note,
          createdById: input.createdById ?? null,
          createdAt: now,
          items: {
            create: priced.lines.map((l) => ({
              itemId: l.itemId,
              itemName: l.itemName,
              quantity: l.quantity,
              pricePerDay: l.pricePerDay,
              depositPerUnit: l.depositPerUnit,
              lineTotal: l.lineTotal,
            })),
          },
          guarantee: { create: { type: input.guaranteeType } },
          events: {
            create: {
              actorId: input.createdById ?? input.userId,
              type: "ORDER_CREATED",
              data: { status, source: input.source, paymentMethod: input.paymentMethod, guaranteeType: input.guaranteeType },
              createdAt: now,
            },
          },
        },
      });

      return {
        id: order.id,
        code: order.code,
        status: order.status,
        paymentMethod: order.paymentMethod,
        guaranteeType: order.guaranteeType,
        startAt: order.startAt,
        endAt: order.endAt,
        rentalDays: order.rentalDays,
        rentalSubtotal: order.rentalSubtotal,
        depositTotal: order.depositTotal,
        totalDue: priced.totalDue,
        paymentDueAt: order.paymentDueAt,
        items: priced.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: l.quantity,
          pricePerDay: l.pricePerDay,
          lineTotal: l.lineTotal,
        })),
      };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}

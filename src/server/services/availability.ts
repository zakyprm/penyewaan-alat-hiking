import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { effectiveEnd, peakUsage, type Booking } from "@/lib/domain/availability";
import { db } from "../db";

/** Client biasa atau client transaksi (`tx`). */
export type DbClient = Prisma.TransactionClient | typeof db;

/**
 * Pesanan yang menahan stok (Req 5.2): DIKONFIRMASI, DIAMBIL, dan MENUNGGU_PEMBAYARAN
 * yang batas bayarnya belum lewat. Pesanan kedaluwarsa langsung tidak menahan stok
 * walau cron belum sempat membatalkannya (design 6.4).
 */
export function holdingOrderWhere(now: Date): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: "DIAMBIL" },
      // DIKONFIRMASI menahan stok, kecuali "bayar di toko" yang lewat batas bayar dan belum dibayar (Req 8.7)
      {
        status: "DIKONFIRMASI",
        OR: [
          { paymentDueAt: null },
          { paymentDueAt: { gt: now } },
          { payments: { some: { purpose: "SEWA_DAN_DEPOSIT", status: "LUNAS" } } },
        ],
      },
      { status: "MENUNGGU_PEMBAYARAN", paymentDueAt: { gt: now } },
    ],
  };
}

export interface RentalWindow {
  start: Date;
  end: Date;
}

/**
 * Unit terpakai bersamaan paling banyak per alat di dalam rentang yang diminta.
 *
 * Memakai puncak pemakaian (sweep line), bukan jumlah semua pesanan yang beririsan:
 * dua pesanan yang tidak saling bertemu di dalam rentang tidak dijumlahkan.
 */
export async function reservedUnits(
  client: DbClient,
  itemIds: readonly string[],
  window: RentalWindow,
  now: Date,
  options: { excludeOrderId?: string } = {},
): Promise<Map<string, number>> {
  const rows = await client.orderItem.findMany({
    where: {
      itemId: { in: [...itemIds] },
      order: {
        AND: [
          holdingOrderWhere(now),
          { startAt: { lt: window.end } },
          // DIAMBIL yang telat tetap dianggap berjalan sampai sekarang; disaring akurat di bawah
          { OR: [{ endAt: { gt: window.start } }, { status: "DIAMBIL" }] },
          ...(options.excludeOrderId ? [{ id: { not: options.excludeOrderId } }] : []),
        ],
      },
    },
    select: { itemId: true, quantity: true, order: { select: { status: true, startAt: true, endAt: true } } },
  });

  const byItem = new Map<string, Booking[]>();
  for (const row of rows) {
    const end = effectiveEnd(row.order.status, row.order.endAt, now);
    if (!(row.order.startAt < window.end && end > window.start)) continue;
    const clipped: Booking = {
      start: row.order.startAt > window.start ? row.order.startAt : window.start,
      end: end < window.end ? end : window.end,
      quantity: row.quantity,
    };
    byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), clipped]);
  }

  return new Map(itemIds.map((id) => [id, peakUsage(byItem.get(id) ?? [])]));
}

export interface ItemAvailability {
  itemId: string;
  stock: number;
  reserved: number;
  available: number;
}

/** Ketersediaan alat pada rentang waktu (Req 3.3, 5.1). Alat yang tidak ada tidak masuk hasil. */
export async function getAvailability(
  itemIds: readonly string[],
  window: RentalWindow,
  options: { client?: DbClient; now?: Date; excludeOrderId?: string } = {},
): Promise<Map<string, ItemAvailability>> {
  const client = options.client ?? db;
  const now = options.now ?? new Date();
  const items = await client.item.findMany({ where: { id: { in: [...itemIds] } }, select: { id: true, stock: true } });
  const reserved = await reservedUnits(client, itemIds, window, now, { excludeOrderId: options.excludeOrderId });

  return new Map(
    items.map((item) => {
      const r = reserved.get(item.id) ?? 0;
      return [item.id, { itemId: item.id, stock: item.stock, reserved: r, available: Math.max(0, item.stock - r) }];
    }),
  );
}

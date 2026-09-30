import "server-only";
import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { z } from "zod";
import { DomainError } from "@/lib/domain/errors";
import { checkTransition } from "@/lib/domain/order-status";
import { BUSINESS_TIME_ZONE } from "@/lib/domain/schedule";
import { db } from "../db";
import {
  createSnapTransaction,
  getTransactionStatus,
  mapMidtransStatus,
  midtransConfig,
  verifyMidtransSignature,
  type PaymentOutcome,
} from "../midtrans";
import { reservedUnits } from "./availability";

/** Alasan pembatalan otomatis; juga penanda boleh dipulihkan jika pembayaran datang terlambat. */
export const EXPIRED_REASON = "Batas waktu pembayaran terlewati.";

export interface SnapSession {
  snapToken: string;
  clientKey: string;
  snapUrl: string;
}

const wib = tz(BUSINESS_TIME_ZONE);

/**
 * Buat (atau pakai ulang) transaksi Snap untuk pesanan online yang menunggu pembayaran (Req 8.2).
 * Token yang masih berlaku dipakai ulang supaya tidak ada dua tagihan aktif.
 */
export async function startOnlinePayment(orderId: string, now = new Date()): Promise<SnapSession> {
  const config = midtransConfig();
  if (!config) throw new DomainError("VALIDASI_GAGAL", "Pembayaran online belum aktif. Silakan pilih bayar di toko.");

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true, user: { select: { email: true } } },
  });
  if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");
  if (order.status !== "MENUNGGU_PEMBAYARAN" || !order.paymentDueAt || order.paymentDueAt <= now) {
    throw new DomainError("TRANSISI_TIDAK_VALID", "Pesanan ini sudah tidak bisa dibayar online.");
  }

  const existing = order.payments.find(
    (p) => p.purpose === "SEWA_DAN_DEPOSIT" && p.channel === "MIDTRANS" && p.status === "MENUNGGU" && p.snapToken,
  );
  if (existing) return { snapToken: existing.snapToken!, clientKey: config.clientKey, snapUrl: config.snapUrl };

  const amount = order.rentalSubtotal + order.depositTotal;
  // Midtrans butuh order_id unik per transaksi; akhiran memungkinkan bayar ulang setelah gagal
  const midtransOrderId = `${order.code}-${now.getTime().toString(36).toUpperCase()}`;
  const items = order.items.map((i) => ({
    id: i.itemId,
    name: `${i.itemName} (${order.rentalDays} hari)`,
    price: i.pricePerDay * order.rentalDays,
    quantity: i.quantity,
  }));
  if (order.depositTotal > 0) {
    items.push({ id: "DEPOSIT", name: "Deposit jaminan (dikembalikan)", price: order.depositTotal, quantity: 1 });
  }

  const snap = await createSnapTransaction({
    orderId: midtransOrderId,
    grossAmount: amount,
    items,
    customer: { name: order.customerName, phone: order.customerPhone, email: order.user?.email },
    expiryStartTime: format(now, "yyyy-MM-dd HH:mm:ss xx", { in: wib }),
    expiryMinutes: Math.max(1, Math.floor((order.paymentDueAt.getTime() - now.getTime()) / 60_000)),
    finishUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/pesanan/${order.code}`,
  });

  await db.payment.create({
    data: {
      orderId: order.id,
      purpose: "SEWA_DAN_DEPOSIT",
      channel: "MIDTRANS",
      amount,
      status: "MENUNGGU",
      midtransOrderId,
      snapToken: snap.token,
      createdAt: now,
    },
  });
  await db.orderEvent.create({ data: { orderId: order.id, type: "PAYMENT_STARTED", data: { midtransOrderId, amount }, createdAt: now } });

  return { snapToken: snap.token, clientKey: config.clientKey, snapUrl: config.snapUrl };
}

export type PaymentResult =
  | "PAID"
  | "RECOVERED"
  | "ALREADY_PAID"
  | "NEEDS_REFUND"
  | "PENDING"
  | "FAILED"
  | "EXPIRED"
  | "AMOUNT_MISMATCH"
  | "UNKNOWN_ORDER";

/**
 * Terapkan hasil pembayaran Midtrans ke Payment dan Order dalam satu transaksi (idempotent).
 * Pembayaran yang tiba setelah pesanan dibatalkan karena kedaluwarsa dipulihkan jika stok masih ada,
 * atau ditandai perlu refund (design 6.1).
 */
async function applyOutcome(paymentId: string, outcome: PaymentOutcome, raw: unknown, now: Date): Promise<PaymentResult> {
  return db.$transaction(async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${current.orderId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: true } });
    const rawJson = raw === undefined ? undefined : (JSON.parse(JSON.stringify(raw)) as object);

    if (payment.status === "LUNAS") return "ALREADY_PAID";
    if (outcome === "PENDING") return "PENDING";

    if (outcome === "FAILED" || outcome === "EXPIRED") {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: outcome === "FAILED" ? "GAGAL" : "KEDALUWARSA", rawNotification: rawJson },
      });
      await tx.orderEvent.create({ data: { orderId: order.id, type: "PAYMENT_FAILED", data: { outcome }, createdAt: now } });
      return outcome;
    }

    await tx.payment.update({ where: { id: payment.id }, data: { status: "LUNAS", paidAt: now, rawNotification: rawJson } });
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "PAYMENT_RECORDED", data: { channel: "MIDTRANS", amount: payment.amount }, createdAt: now },
    });

    const ctx = {
      actor: "SYSTEM" as const,
      guaranteeType: order.guaranteeType,
      guaranteeStatus: "BELUM_DITERIMA" as const,
      rentalPaid: true,
      outstandingCharges: 0,
      depositSettled: false,
    };

    if (order.status === "MENUNGGU_PEMBAYARAN" && checkTransition(order.status, "DIKONFIRMASI", ctx).ok) {
      await tx.order.update({ where: { id: order.id }, data: { status: "DIKONFIRMASI" } });
      await tx.orderEvent.create({
        data: { orderId: order.id, type: "STATUS_CHANGED", data: { from: order.status, to: "DIKONFIRMASI" }, createdAt: now },
      });
      return "PAID";
    }

    if (order.status === "DIBATALKAN" && order.cancelReason === EXPIRED_REASON && order.startAt > now) {
      const itemIds = [...new Set(order.items.map((i) => i.itemId))].sort();
      await tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ANY(${itemIds}) ORDER BY "id" FOR UPDATE`;
      const stocks = await tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, stock: true } });
      const reserved = await reservedUnits(tx, itemIds, { start: order.startAt, end: order.endAt }, now);
      const fits = order.items.every(
        (i) => (stocks.find((s) => s.id === i.itemId)?.stock ?? 0) - (reserved.get(i.itemId) ?? 0) >= i.quantity,
      );
      if (fits && checkTransition("DIBATALKAN", "DIKONFIRMASI", { ...ctx, latePaymentRecovery: true }).ok) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "DIKONFIRMASI", cancelledAt: null, cancelReason: null },
        });
        await tx.orderEvent.create({
          data: { orderId: order.id, type: "STATUS_CHANGED", data: { from: "DIBATALKAN", to: "DIKONFIRMASI", reason: "LATE_PAYMENT" }, createdAt: now },
        });
        return "RECOVERED";
      }
    }

    // Uang masuk, tapi pesanan tidak bisa dikonfirmasi: admin perlu mengembalikan dana
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "PAYMENT_NEEDS_REFUND", data: { amount: payment.amount, status: order.status }, createdAt: now },
    });
    return "NEEDS_REFUND";
  });
}

const notificationSchema = z.looseObject({
  order_id: z.string().min(1).max(100),
  status_code: z.string().max(10),
  gross_amount: z.string().max(30),
  signature_key: z.string().max(256),
});

/** Webhook Midtrans (Req 8.3, 8.4): verifikasi signature, cek ulang status ke Midtrans, lalu terapkan. */
export async function handleMidtransNotification(body: unknown, now = new Date()): Promise<PaymentResult> {
  const config = midtransConfig();
  if (!config) throw new DomainError("TIDAK_BERWENANG", "Pembayaran online belum aktif.");

  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success || !verifyMidtransSignature(parsed.data, config.serverKey)) {
    throw new DomainError("TIDAK_BERWENANG", "Signature notifikasi tidak valid.");
  }

  const payment = await db.payment.findUnique({ where: { midtransOrderId: parsed.data.order_id } });
  if (!payment) return "UNKNOWN_ORDER";

  const status = await getTransactionStatus(parsed.data.order_id);
  if (Math.round(Number(status.gross_amount)) !== payment.amount) {
    await db.orderEvent.create({
      data: { orderId: payment.orderId, type: "PAYMENT_AMOUNT_MISMATCH", data: { expected: payment.amount, got: status.gross_amount ?? null }, createdAt: now },
    });
    return "AMOUNT_MISMATCH";
  }
  return applyOutcome(payment.id, mapMidtransStatus(status.transaction_status, status.fraud_status), body, now);
}

/**
 * Cek status transaksi Midtrans yang masih menunggu, untuk pesanan tertentu.
 * Dipakai saat pelanggan membuka pesanannya, supaya status tetap benar walau webhook
 * belum sampai (misal saat development di localhost).
 */
export async function syncPendingPayments(orderId: string, now = new Date()): Promise<void> {
  if (!midtransConfig()) return;
  const pending = await db.payment.findMany({ where: { orderId, channel: "MIDTRANS", status: "MENUNGGU" } });
  for (const p of pending) {
    try {
      const status = await getTransactionStatus(p.midtransOrderId!);
      if (status.status_code === "404") continue; // belum dibayar/dipilih metodenya
      if (Math.round(Number(status.gross_amount)) !== p.amount) continue;
      await applyOutcome(p.id, mapMidtransStatus(status.transaction_status, status.fraud_status), undefined, now);
    } catch (error) {
      console.error("[midtrans] gagal cek status:", error);
    }
  }
}

/**
 * Batalkan pesanan yang lewat batas bayar (design 6.4):
 * - MENUNGGU_PEMBAYARAN (online) yang `paymentDueAt` sudah lewat
 * - DIKONFIRMASI bayar di toko yang `paymentDueAt` sudah lewat dan belum dibayar
 * Walk-in tidak punya batas bayar. Mengembalikan jumlah pesanan yang dibatalkan.
 */
export async function expireOrders(now = new Date(), options: { orderId?: string } = {}): Promise<number> {
  const unpaid = { payments: { none: { purpose: "SEWA_DAN_DEPOSIT" as const, status: "LUNAS" as const } } };
  const candidates = await db.order.findMany({
    where: {
      ...(options.orderId ? { id: options.orderId } : {}),
      paymentDueAt: { lte: now },
      OR: [{ status: "MENUNGGU_PEMBAYARAN" }, { status: "DIKONFIRMASI", ...unpaid }],
    },
    select: { id: true, status: true },
  });

  let cancelled = 0;
  for (const order of candidates) {
    await db.$transaction(async (tx) => {
      // Status dan "belum dibayar" dicek ulang saat update, supaya tidak bentrok dengan pembayaran yang baru masuk
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status, ...unpaid },
        data: { status: "DIBATALKAN", cancelledAt: now, cancelReason: EXPIRED_REASON },
      });
      if (count === 0) return;
      cancelled++;
      await tx.payment.updateMany({ where: { orderId: order.id, status: "MENUNGGU" }, data: { status: "KEDALUWARSA" } });
      await tx.orderEvent.create({
        data: { orderId: order.id, type: "STATUS_CHANGED", data: { from: order.status, to: "DIBATALKAN", reason: "EXPIRED" }, createdAt: now },
      });
    });
  }
  return cancelled;
}

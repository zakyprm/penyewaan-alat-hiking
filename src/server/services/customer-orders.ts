import "server-only";
import { DomainError } from "@/lib/domain/errors";
import { graceEndsAt } from "@/lib/domain/fine";
import { checkTransition } from "@/lib/domain/order-status";
import type { OrderStatus } from "@/lib/domain/types";
import type { CheckoutInput } from "@/lib/validation/order";
import { db } from "../db";
import { isMidtransEnabled } from "../midtrans";
import type { SessionUser } from "../session";
import { createOrder, type CreatedOrder } from "./orders";
import { expireOrders, startOnlinePayment, syncPendingPayments, type SnapSession } from "./payments";

/**
 * Checkout pelanggan (Req 8). Pesanan online bayar online langsung dibuatkan transaksi Snap;
 * jika Snap gagal, pesanan tetap ada dan pelanggan bisa mencoba bayar lagi dari halaman pesanan.
 */
export async function placeCustomerOrder(
  user: SessionUser,
  input: CheckoutInput,
  now = new Date(),
): Promise<{ order: CreatedOrder; payment: SnapSession | null }> {
  if (input.paymentMethod === "ONLINE" && !isMidtransEnabled()) {
    throw new DomainError("VALIDASI_GAGAL", "Pembayaran online belum aktif. Silakan pilih bayar di toko.", [
      { path: "paymentMethod", message: "Pembayaran online belum aktif" },
    ]);
  }

  const order = await createOrder({
    source: "ONLINE",
    userId: user.id,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    items: input.items,
    startAt: input.startAt,
    endAt: input.endAt,
    guaranteeType: input.guaranteeType,
    paymentMethod: input.paymentMethod,
    note: input.note,
    now,
  });

  let payment: SnapSession | null = null;
  if (input.paymentMethod === "ONLINE") {
    try {
      payment = await startOnlinePayment(order.id, now);
    } catch (error) {
      console.error("[checkout] gagal membuat transaksi Midtrans:", error);
    }
  }
  return { order, payment };
}

async function findOwnOrder(userId: string, code: string) {
  const order = await db.order.findFirst({ where: { code, userId }, select: { id: true } });
  // Pesanan milik orang lain dijawab sama dengan "tidak ada"
  if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");
  return order.id;
}

export interface CustomerOrderSummary {
  code: string;
  status: OrderStatus;
  startAt: Date;
  endAt: Date;
  totalDue: number;
  itemCount: number;
  itemSummary: string;
  createdAt: Date;
}

/** Daftar pesanan milik pelanggan, terbaru dulu (Req 9.1). */
export async function listCustomerOrders(userId: string): Promise<CustomerOrderSummary[]> {
  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { itemName: true, quantity: true } } },
  });
  return orders.map((o) => ({
    code: o.code,
    status: o.status,
    startAt: o.startAt,
    endAt: o.endAt,
    totalDue: o.rentalSubtotal + o.depositTotal,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    itemSummary: o.items.map((i) => i.itemName).join(", "),
    createdAt: o.createdAt,
  }));
}

/** Detail pesanan milik pelanggan. Status disegarkan dulu (kedaluwarsa, status Midtrans). */
export async function getCustomerOrder(userId: string, code: string, now = new Date()) {
  const id = await findOwnOrder(userId, code);
  await syncPendingPayments(id, now);
  await expireOrders(now, { orderId: id });

  const order = await db.order.findUniqueOrThrow({
    where: { id },
    include: {
      items: { include: { item: { select: { slug: true, images: { orderBy: { order: "asc" }, take: 1, select: { url: true } } } } } },
      payments: { orderBy: { createdAt: "asc" } },
      guarantee: true,
      charges: true,
    },
  });
  const rentalPaid = order.payments.some((p) => p.purpose === "SEWA_DAN_DEPOSIT" && p.status === "LUNAS");

  return {
    id: order.id,
    code: order.code,
    status: order.status,
    paymentMethod: order.paymentMethod,
    guaranteeType: order.guaranteeType,
    guaranteeStatus: order.guarantee?.status ?? "BELUM_DITERIMA",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    startAt: order.startAt,
    endAt: order.endAt,
    graceEndsAt: graceEndsAt(order.endAt, order.graceHours),
    graceHours: order.graceHours,
    rentalDays: order.rentalDays,
    rentalSubtotal: order.rentalSubtotal,
    depositTotal: order.depositTotal,
    totalDue: order.rentalSubtotal + order.depositTotal,
    paymentDueAt: order.paymentDueAt,
    rentalPaid,
    cancelReason: order.cancelReason,
    note: order.note,
    createdAt: order.createdAt,
    canPayOnline:
      order.paymentMethod === "ONLINE" &&
      order.status === "MENUNGGU_PEMBAYARAN" &&
      order.paymentDueAt !== null &&
      order.paymentDueAt > now &&
      isMidtransEnabled(),
    canCancel: checkTransition(order.status, "DIBATALKAN", {
      actor: "CUSTOMER",
      guaranteeType: order.guaranteeType,
      guaranteeStatus: order.guarantee?.status ?? "BELUM_DITERIMA",
      rentalPaid,
      outstandingCharges: 0,
      depositSettled: false,
    }).ok,
    items: order.items.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      slug: i.item.slug,
      image: i.item.images[0]?.url ?? null,
      quantity: i.quantity,
      pricePerDay: i.pricePerDay,
      lineTotal: i.lineTotal,
    })),
    charges: order.charges.map((c) => ({ type: c.type, amount: c.amount, note: c.note })),
  };
}
export type CustomerOrder = Awaited<ReturnType<typeof getCustomerOrder>>;

/** Mulai / lanjutkan pembayaran online pesanan milik pelanggan. */
export async function payCustomerOrder(userId: string, code: string, now = new Date()) {
  const id = await findOwnOrder(userId, code);
  await expireOrders(now, { orderId: id });
  return startOnlinePayment(id, now);
}

/** Pelanggan membatalkan pesanan sendiri (Req 9.3): hanya sebelum lunas. */
export async function cancelCustomerOrder(userId: string, code: string, now = new Date()): Promise<void> {
  const id = await findOwnOrder(userId, code);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { payments: true, guarantee: true } });
    const rentalPaid = order.payments.some((p) => p.purpose === "SEWA_DAN_DEPOSIT" && p.status === "LUNAS");
    const ctx = {
      actor: "CUSTOMER" as const,
      guaranteeType: order.guaranteeType,
      guaranteeStatus: order.guarantee?.status ?? ("BELUM_DITERIMA" as const),
      rentalPaid,
      outstandingCharges: 0,
      depositSettled: false,
    };
    if (checkTransition(order.status, "DIBATALKAN", ctx).ok === false) {
      throw new DomainError("TRANSISI_TIDAK_VALID", "Pesanan ini sudah tidak bisa dibatalkan.");
    }
    await tx.order.update({ where: { id }, data: { status: "DIBATALKAN", cancelledAt: now, cancelReason: "Dibatalkan oleh pelanggan." } });
    await tx.payment.updateMany({ where: { orderId: id, status: "MENUNGGU" }, data: { status: "GAGAL" } });
    await tx.orderEvent.create({
      data: { orderId: id, actorId: userId, type: "STATUS_CHANGED", data: { from: order.status, to: "DIBATALKAN", reason: "CUSTOMER" }, createdAt: now },
    });
  });
}

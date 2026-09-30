import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { lateFine, returnTimeliness, type ReturnTimeliness } from "@/lib/domain/fine";
import { assertTransition, availableTransitions, checkTransition } from "@/lib/domain/order-status";
import { settle, type SettlementResult } from "@/lib/domain/settlement";
import type { GuaranteeStatus, OrderStatus } from "@/lib/domain/types";
import { normalizePhone } from "@/lib/validation/common";
import type { AdminOrderListQuery } from "@/lib/validation/admin-order-query";
import type { RecordPaymentInput, ReturnOrderInput, WalkInOrderInput } from "@/lib/validation/order";
import { db } from "../db";
import type { SessionUser } from "../session";
import { createOrder, type CreatedOrder } from "./orders";

// ---------- Daftar (Req 14.1, 14.2, 14.5) ----------

export interface AdminOrderSummary {
  id: string;
  code: string;
  status: OrderStatus;
  source: "ONLINE" | "WALK_IN";
  paymentMethod: "ONLINE" | "BAYAR_DI_TOKO";
  customerName: string;
  customerPhone: string;
  startAt: Date;
  endAt: Date;
  totalDue: number;
  rentalPaid: boolean;
  itemSummary: string;
  /** Hanya relevan saat DIAMBIL: dipakai untuk badge terlambat/dalam grace */
  timeliness: ReturnTimeliness | null;
}

export async function listAdminOrders(query: AdminOrderListQuery, now = new Date()): Promise<AdminOrderSummary[]> {
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.method ? { paymentMethod: query.method } : {}),
    ...(query.from || query.to ? { startAt: { gte: query.from, lte: query.to } } : {}),
    ...(query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: "insensitive" } },
            { customerName: { contains: query.q, mode: "insensitive" } },
            { customerPhone: { contains: normalizePhone(query.q) } },
          ],
        }
      : {}),
  };

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      items: { select: { itemName: true, quantity: true } },
      payments: { where: { purpose: "SEWA_DAN_DEPOSIT", status: "LUNAS" }, select: { id: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    source: o.source,
    paymentMethod: o.paymentMethod,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    startAt: o.startAt,
    endAt: o.endAt,
    totalDue: o.rentalSubtotal + o.depositTotal,
    rentalPaid: o.payments.length > 0,
    itemSummary: o.items.map((i) => `${i.itemName} ×${i.quantity}`).join(", "),
    timeliness: o.status === "DIAMBIL" ? returnTimeliness(o.endAt, o.graceHours, now) : null,
  }));
}

// ---------- Detail (Req 14.3, 14.4) ----------

const detailInclude = {
  items: true,
  payments: { orderBy: { createdAt: "asc" } },
  charges: { orderBy: { createdAt: "asc" } },
  guarantee: true,
  events: { orderBy: { createdAt: "desc" } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OrderInclude;

type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

async function loadOrder(id: string): Promise<OrderDetailRow> {
  const order = await db.order.findUnique({ where: { id }, include: detailInclude });
  if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");
  return order;
}

function rentalPaidOf(order: OrderDetailRow): boolean {
  return order.payments.some((p) => p.purpose === "SEWA_DAN_DEPOSIT" && p.status === "LUNAS");
}

/** Denda yang belum dibayar tunai (belum dikurangi potongan deposit). */
function netChargesOf(order: OrderDetailRow): number {
  const totalCharges = order.charges.reduce((sum, c) => sum + c.amount, 0);
  const paidCharges = order.payments
    .filter((p) => p.purpose === "DENDA" && p.status === "LUNAS")
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, totalCharges - paidCharges);
}

/**
 * Denda yang masih harus ditagih tunai ke pelanggan (Req 11.4, 11.5): untuk jaminan deposit,
 * sisa denda dipotong dulu dari deposit (lihat `settle()`); sisa setelah itu baru dianggap
 * "belum dibayar" dan menghalangi transisi ke SELESAI. Untuk KTP, seluruh denda harus tunai.
 */
function outstandingChargesOf(order: OrderDetailRow): number {
  const netCharges = netChargesOf(order);
  return order.guaranteeType === "DEPOSIT" ? Math.max(0, netCharges - order.depositTotal) : netCharges;
}

function depositSettledOf(order: OrderDetailRow): boolean {
  if (order.guaranteeType !== "DEPOSIT") return true;
  if (order.status !== "DIKEMBALIKAN") return false;
  const refundDue = Math.max(0, order.depositTotal - netChargesOf(order));
  if (refundDue === 0) return true; // seluruh deposit terpakai untuk denda, tidak ada yang perlu dikembalikan
  return order.payments.some((p) => p.purpose === "REFUND_DEPOSIT" && p.status === "LUNAS");
}

function transitionContext(order: OrderDetailRow) {
  return {
    actor: "ADMIN" as const,
    guaranteeType: order.guaranteeType,
    guaranteeStatus: order.guarantee?.status ?? ("BELUM_DITERIMA" as GuaranteeStatus),
    rentalPaid: rentalPaidOf(order),
    outstandingCharges: outstandingChargesOf(order),
    depositSettled: depositSettledOf(order),
  };
}

function toAdminOrderDetail(order: OrderDetailRow) {
  const ctx = transitionContext(order);
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    source: order.source,
    paymentMethod: order.paymentMethod,
    guaranteeType: order.guaranteeType,
    guaranteeStatus: order.guarantee?.status ?? "BELUM_DITERIMA",
    customer: order.user ? { id: order.user.id, name: order.user.name, email: order.user.email } : null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    startAt: order.startAt,
    endAt: order.endAt,
    graceHours: order.graceHours,
    lateFinePercent: order.lateFinePercent,
    rentalDays: order.rentalDays,
    rentalSubtotal: order.rentalSubtotal,
    depositTotal: order.depositTotal,
    totalDue: order.rentalSubtotal + order.depositTotal,
    paymentDueAt: order.paymentDueAt,
    pickedUpAt: order.pickedUpAt,
    returnedAt: order.returnedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    note: order.note,
    createdAt: order.createdAt,
    rentalPaid: ctx.rentalPaid,
    outstandingCharges: ctx.outstandingCharges,
    depositSettled: ctx.depositSettled,
    availableActions: availableTransitions(order.status, ctx),
    items: order.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      itemName: i.itemName,
      quantity: i.quantity,
      pricePerDay: i.pricePerDay,
      depositPerUnit: i.depositPerUnit,
      lineTotal: i.lineTotal,
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      channel: p.channel,
      amount: p.amount,
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
    charges: order.charges.map((c) => ({ id: c.id, type: c.type, orderItemId: c.orderItemId, amount: c.amount, note: c.note, createdAt: c.createdAt })),
    events: order.events.map((e) => ({ id: e.id, type: e.type, actorId: e.actorId, data: e.data, createdAt: e.createdAt })),
  };
}
export type AdminOrderDetail = ReturnType<typeof toAdminOrderDetail>;

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  return toAdminOrderDetail(await loadOrder(id));
}

// ---------- Aksi (Req 7.7, 8.8, 14.3, 14.4) ----------

/** Catat pembayaran manual: sewa di toko, denda, atau refund deposit (Req 8.8, 11.4). */
export async function recordManualPayment(orderId: string, admin: SessionUser, input: RecordPaymentInput, now = new Date()) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");

    const payment = await tx.payment.create({
      data: { orderId, purpose: input.purpose, channel: input.channel, amount: input.amount, status: "LUNAS", paidAt: now, recordedById: admin.id },
    });
    await tx.orderEvent.create({
      data: { orderId, actorId: admin.id, type: "PAYMENT_RECORDED", data: { purpose: input.purpose, channel: input.channel, amount: input.amount, note: input.note }, createdAt: now },
    });

    // Sewa di toko yang baru lunas: konfirmasi otomatis dari MENUNGGU_PEMBAYARAN jika masih di status itu
    if (input.purpose === "SEWA_DAN_DEPOSIT" && order.status === "MENUNGGU_PEMBAYARAN") {
      await tx.order.update({ where: { id: orderId }, data: { status: "DIKONFIRMASI" } });
      await tx.orderEvent.create({ data: { orderId, actorId: admin.id, type: "STATUS_CHANGED", data: { from: "MENUNGGU_PEMBAYARAN", to: "DIKONFIRMASI" }, createdAt: now } });
    }
    return payment;
  });
}

/** Terima atau kembalikan jaminan KTP (Req 7.6, 7.7). */
export async function updateGuaranteeStatus(orderId: string, admin: SessionUser, action: "RECEIVE" | "RETURN", now = new Date()) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { guarantee: true } });
  if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");
  if (!order.guarantee || order.guaranteeType !== "KTP") {
    throw new DomainError("VALIDASI_GAGAL", "Pesanan ini tidak memakai jaminan KTP.");
  }
  const status: GuaranteeStatus = action === "RECEIVE" ? "DITERIMA" : "DIKEMBALIKAN";
  if (action === "RECEIVE" && order.guarantee.status !== "BELUM_DITERIMA") {
    throw new DomainError("TRANSISI_TIDAK_VALID", "KTP sudah tercatat diterima.");
  }
  if (action === "RETURN" && order.guarantee.status !== "DITERIMA") {
    throw new DomainError("TRANSISI_TIDAK_VALID", "KTP belum diterima, belum bisa dikembalikan.");
  }

  await db.$transaction([
    db.guarantee.update({
      where: { orderId },
      data:
        action === "RECEIVE"
          ? { status, receivedAt: now, receivedById: admin.id }
          : { status, returnedAt: now, returnedById: admin.id },
    }),
    db.orderEvent.create({ data: { orderId, actorId: admin.id, type: action === "RECEIVE" ? "GUARANTEE_RECEIVED" : "GUARANTEE_RETURNED", createdAt: now } }),
  ]);
}

async function changeStatus(orderId: string, admin: SessionUser, to: OrderStatus, now: Date, extra: Prisma.OrderUpdateInput = {}) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: detailInclude });
    if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");
    assertTransition(order.status, to, transitionContext(order));

    await tx.order.update({ where: { id: orderId }, data: { status: to, ...extra } });
    await tx.orderEvent.create({ data: { orderId, actorId: admin.id, type: "STATUS_CHANGED", data: { from: order.status, to }, createdAt: now } });
    return to;
  });
}

/** Serah alat ke pelanggan (Req 7.7, 14.3). */
export async function pickupOrder(orderId: string, admin: SessionUser, now = new Date()): Promise<void> {
  await changeStatus(orderId, admin, "DIAMBIL", now, { pickedUpAt: now });
}

/** Admin membatalkan pesanan dengan alasan (Req 14.3, 14.4). */
export async function cancelOrderByAdmin(orderId: string, admin: SessionUser, reason: string, now = new Date()): Promise<void> {
  await changeStatus(orderId, admin, "DIBATALKAN", now, { cancelledAt: now, cancelReason: reason });
}

// ---------- Pengembalian, denda, dan penyelesaian (Req 11) ----------

/**
 * Catat pengembalian alat (Req 11.1–11.3): DIAMBIL → DIKEMBALIKAN.
 * Denda telat dihitung otomatis dari kebijakan yang disnapshot di pesanan (tidak dikirim klien).
 * Denda kerusakan/kehilangan diinput admin per alat.
 */
export async function returnOrder(orderId: string, admin: SessionUser, input: ReturnOrderInput, now = new Date()): Promise<void> {
  const returnedAt = input.returnedAt ?? now;

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: detailInclude });
    if (!order) throw new DomainError("TIDAK_DITEMUKAN", "Pesanan tidak ditemukan.");
    assertTransition(order.status, "DIKEMBALIKAN", transitionContext(order));

    for (const charge of input.charges) {
      if (!order.items.some((i) => i.id === charge.orderItemId)) {
        throw new DomainError("VALIDASI_GAGAL", "Alat tidak ditemukan pada pesanan ini.", [
          { path: "charges", message: "orderItemId tidak valid" },
        ]);
      }
    }

    const fine = lateFine({
      endAt: order.endAt,
      returnedAt,
      graceHours: order.graceHours,
      lateFinePercent: order.lateFinePercent,
      lines: order.items,
    });

    await tx.order.update({ where: { id: orderId }, data: { status: "DIKEMBALIKAN", returnedAt } });
    if (fine.amount > 0) {
      await tx.orderCharge.create({ data: { orderId, type: "TELAT", amount: fine.amount, note: `Terlambat ${fine.lateDays} hari`, createdById: admin.id, createdAt: now } });
    }
    for (const charge of input.charges) {
      await tx.orderCharge.create({ data: { orderId, type: charge.type, orderItemId: charge.orderItemId, amount: charge.amount, note: charge.note, createdById: admin.id, createdAt: now } });
    }
    await tx.orderEvent.create({
      data: { orderId, actorId: admin.id, type: "STATUS_CHANGED", data: { from: order.status, to: "DIKEMBALIKAN", lateDays: fine.lateDays, lateFine: fine.amount, manualCharges: input.charges.length }, createdAt: now },
    });
  });
}

export interface SettlementPreview extends SettlementResult {
  depositTotal: number;
  totalCharges: number;
}

/**
 * Pratinjau penyelesaian jaminan (Req 11.4, 11.5): berapa yang dikembalikan/ditagih.
 * Memakai denda yang belum dibayar tunai (`netChargesOf`), sehingga jika admin sudah mencatat
 * sebagian pembayaran DENDA sebelumnya, pratinjau ini tetap menunjukkan sisa yang benar.
 */
export async function getSettlementPreview(orderId: string): Promise<SettlementPreview> {
  const order = await loadOrder(orderId);
  const totalCharges = netChargesOf(order);
  const result = settle(order.guaranteeType, order.depositTotal, totalCharges);
  return { ...result, depositTotal: order.depositTotal, totalCharges };
}

/** DIKEMBALIKAN → SELESAI: semua denda lunas dan jaminan sudah diselesaikan (Req 11.6). */
export async function completeOrder(orderId: string, admin: SessionUser, now = new Date()): Promise<void> {
  await changeStatus(orderId, admin, "SELESAI", now, { completedAt: now });
}

/** Aksi apa saja yang valid saat ini, tanpa mengambil seluruh detail (dipakai UI list). */
export function canTransitionTo(order: OrderDetailRow, to: OrderStatus): boolean {
  return checkTransition(order.status, to, transitionContext(order)).ok;
}

// ---------- Sewa walk-in (Req 13) ----------

/**
 * Buat pesanan walk-in (Req 13.1–13.6). Memakai `createOrder` yang sama dengan checkout online,
 * jadi aturan ketersediaan, biaya, dan jaminan identik. Jika `pickupNow` dipilih, langsung
 * mencatat pembayaran lunas, menerima jaminan (jika KTP), dan menyerahkan alat (Req 13.7).
 */
export async function createWalkInOrder(admin: SessionUser, input: WalkInOrderInput, now = new Date()): Promise<CreatedOrder> {
  let userId: string | null = null;
  let customerName: string;
  let customerPhone: string;

  if (input.customer.type === "REGISTERED") {
    const user = await db.user.findUnique({ where: { id: input.customer.userId }, select: { id: true, name: true, phone: true } });
    if (!user) throw new DomainError("VALIDASI_GAGAL", "Pelanggan tidak ditemukan.", [{ path: "customer", message: "Pelanggan tidak ditemukan" }]);
    userId = user.id;
    customerName = user.name;
    customerPhone = user.phone ?? "";
  } else {
    customerName = input.customer.name;
    customerPhone = input.customer.phone;
  }

  const order = await createOrder({
    source: "WALK_IN",
    userId,
    customerName,
    customerPhone,
    items: input.items,
    startAt: input.startAt,
    endAt: input.endAt,
    guaranteeType: input.guaranteeType,
    paymentMethod: input.paymentMethod,
    note: input.note,
    createdById: admin.id,
    now,
  });

  if (input.pickupNow) {
    await recordManualPayment(order.id, admin, { purpose: "SEWA_DAN_DEPOSIT", channel: input.paymentChannel!, amount: order.totalDue }, now);
    if (input.guaranteeType === "KTP") await updateGuaranteeStatus(order.id, admin, "RECEIVE", now);
    await pickupOrder(order.id, admin, now);
  }

  return order;
}

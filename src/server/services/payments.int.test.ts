import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import * as midtrans from "../midtrans";
import { createOrder } from "./orders";
import { expireOrders, handleMidtransNotification, startOnlinePayment } from "./payments";

const now = wib("2030-01-10T10:00");
const SERVER_KEY = "SB-Mid-server-uji";

function sign(n: { order_id: string; status_code: string; gross_amount: string }, key = SERVER_KEY) {
  return createHash("sha512").update(`${n.order_id}${n.status_code}${n.gross_amount}${key}`).digest("hex");
}

async function orderOnline(overrides: Parameters<typeof createOrder>[0] extends infer T ? Partial<T> : never = {}) {
  const item = await createItem({ stock: 3, pricePerDay: 50_000, depositPerUnit: 100_000 });
  return createOrder({
    source: "ONLINE",
    userId: null,
    customerName: "Budi",
    customerPhone: "081234567890",
    items: [{ itemId: item.id, quantity: 1 }],
    startAt: wib("2030-01-12T10:00"),
    endAt: wib("2030-01-14T10:00"),
    guaranteeType: "DEPOSIT",
    paymentMethod: "ONLINE",
    now,
    ...overrides,
  });
}

beforeEach(async () => {
  await resetDatabase();
  vi.spyOn(midtrans, "midtransConfig").mockReturnValue({
    serverKey: SERVER_KEY,
    clientKey: "SB-Mid-client-uji",
    isProduction: false,
    snapUrl: "https://app.sandbox.midtrans.com",
    apiUrl: "https://api.sandbox.midtrans.com",
  });
});
afterEach(() => vi.restoreAllMocks());

describe("startOnlinePayment (Req 8.2)", () => {
  it("membuat transaksi Snap dan menyimpan token", async () => {
    const created = await orderOnline();
    const snapSpy = vi
      .spyOn(midtrans, "createSnapTransaction")
      .mockResolvedValue({ token: "token-abc", redirectUrl: "https://x/redirect" });

    const session = await startOnlinePayment(created.id, now);
    expect(session).toMatchObject({ snapToken: "token-abc", clientKey: "SB-Mid-client-uji" });
    expect(snapSpy).toHaveBeenCalledWith(expect.objectContaining({ grossAmount: created.totalDue }));

    const payment = await db.payment.findFirstOrThrow({ where: { orderId: created.id } });
    expect(payment).toMatchObject({ purpose: "SEWA_DAN_DEPOSIT", channel: "MIDTRANS", status: "MENUNGGU", snapToken: "token-abc" });
  });

  it("token yang masih berlaku dipakai ulang, tidak membuat transaksi baru", async () => {
    const created = await orderOnline();
    const snapSpy = vi.spyOn(midtrans, "createSnapTransaction").mockResolvedValue({ token: "t1", redirectUrl: "" });
    await startOnlinePayment(created.id, now);
    const second = await startOnlinePayment(created.id, now);
    expect(second.snapToken).toBe("t1");
    expect(snapSpy).toHaveBeenCalledTimes(1);
  });

  it("menolak pesanan yang bukan lagi MENUNGGU_PEMBAYARAN", async () => {
    const item = await createItem();
    const order = await createOrder({
      source: "ONLINE",
      userId: null,
      customerName: "Budi",
      customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }],
      startAt: wib("2030-01-12T10:00"),
      endAt: wib("2030-01-14T10:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now,
    });
    await expect(startOnlinePayment(order.id, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });
});

describe("handleMidtransNotification (Req 8.3, 8.4)", () => {
  async function withPayment() {
    const created = await orderOnline();
    vi.spyOn(midtrans, "createSnapTransaction").mockResolvedValue({ token: "t1", redirectUrl: "" });
    await startOnlinePayment(created.id, now);
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: created.id } });
    return { created, midtransOrderId: payment.midtransOrderId! };
  }

  it("notifikasi lunas → pesanan DIKONFIRMASI, pembayaran LUNAS", async () => {
    const { created, midtransOrderId } = await withPayment();
    const notif = { order_id: midtransOrderId, status_code: "200", gross_amount: `${created.totalDue}.00` };
    vi.spyOn(midtrans, "getTransactionStatus").mockResolvedValue({
      status_code: "200",
      transaction_status: "settlement",
      gross_amount: notif.gross_amount,
    });

    const result = await handleMidtransNotification({ ...notif, signature_key: sign(notif) }, now);
    expect(result).toBe("PAID");
    const order = await db.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(order.status).toBe("DIKONFIRMASI");
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: created.id } });
    expect(payment.status).toBe("LUNAS");
  });

  it("signature tidak valid ditolak, status tidak berubah", async () => {
    const { created, midtransOrderId } = await withPayment();
    const notif = { order_id: midtransOrderId, status_code: "200", gross_amount: `${created.totalDue}.00` };
    await expect(handleMidtransNotification({ ...notif, signature_key: "salah" }, now)).rejects.toMatchObject({
      code: "TIDAK_BERWENANG",
    });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: created.id } })).status).toBe("MENUNGGU");
  });

  it("idempotent: notifikasi lunas dua kali tidak error dan tidak dobel event", async () => {
    const { created, midtransOrderId } = await withPayment();
    const notif = { order_id: midtransOrderId, status_code: "200", gross_amount: `${created.totalDue}.00` };
    vi.spyOn(midtrans, "getTransactionStatus").mockResolvedValue({
      status_code: "200",
      transaction_status: "settlement",
      gross_amount: notif.gross_amount,
    });
    const signed = { ...notif, signature_key: sign(notif) };
    await handleMidtransNotification(signed, now);
    const result = await handleMidtransNotification(signed, now);
    expect(result).toBe("ALREADY_PAID");
    expect(await db.orderEvent.count({ where: { orderId: created.id, type: "PAYMENT_RECORDED" } })).toBe(1);
  });

  it("nominal tidak sesuai ditolak sebelum mengubah status", async () => {
    const { created, midtransOrderId } = await withPayment();
    const notif = { order_id: midtransOrderId, status_code: "200", gross_amount: "1.00" }; // beda dari totalDue
    vi.spyOn(midtrans, "getTransactionStatus").mockResolvedValue({ status_code: "200", transaction_status: "settlement", gross_amount: "1.00" });
    const result = await handleMidtransNotification({ ...notif, signature_key: sign(notif) }, now);
    expect(result).toBe("AMOUNT_MISMATCH");
    expect((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("MENUNGGU_PEMBAYARAN");
  });

  it("pembayaran lunas yang tiba setelah kedaluwarsa dipulihkan jika stok masih cukup", async () => {
    const { created, midtransOrderId } = await withPayment();
    await expireOrders(wib("2030-01-10T11:01")); // batas 60 menit sudah lewat
    expect((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("DIBATALKAN");

    const notif = { order_id: midtransOrderId, status_code: "200", gross_amount: `${created.totalDue}.00` };
    vi.spyOn(midtrans, "getTransactionStatus").mockResolvedValue({ status_code: "200", transaction_status: "settlement", gross_amount: notif.gross_amount });
    const result = await handleMidtransNotification({ ...notif, signature_key: sign(notif) }, wib("2030-01-10T11:05"));
    expect(result).toBe("RECOVERED");
    expect((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("DIKONFIRMASI");
  });

  it("pembayaran lunas terlambat tapi stok sudah diambil orang lain → perlu refund manual", async () => {
    const { created, midtransOrderId } = await withPayment();
    await expireOrders(wib("2030-01-10T11:01"));
    const order = await db.order.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } });
    // Unit satu-satunya diambil pesanan lain setelah kedaluwarsa
    await createOrder({
      source: "WALK_IN",
      userId: null,
      customerName: "Lain",
      customerPhone: "081200000000",
      items: [{ itemId: order.items[0].itemId, quantity: 3 }],
      startAt: order.startAt,
      endAt: order.endAt,
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now: wib("2030-01-10T11:02"),
    });

    const notif = { order_id: midtransOrderId, status_code: "200", gross_amount: `${created.totalDue}.00` };
    vi.spyOn(midtrans, "getTransactionStatus").mockResolvedValue({ status_code: "200", transaction_status: "settlement", gross_amount: notif.gross_amount });
    const result = await handleMidtransNotification({ ...notif, signature_key: sign(notif) }, wib("2030-01-10T11:05"));
    expect(result).toBe("NEEDS_REFUND");
    expect((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("DIBATALKAN");
    expect(await db.orderEvent.count({ where: { orderId: created.id, type: "PAYMENT_NEEDS_REFUND" } })).toBe(1);
  });
});

describe("expireOrders (Req 8.5, 8.7)", () => {
  it("membatalkan MENUNGGU_PEMBAYARAN online yang lewat batas, dan melepas stoknya", async () => {
    const item = await createItem({ stock: 1 });
    const order = await createOrder({
      source: "ONLINE",
      userId: null,
      customerName: "Budi",
      customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }],
      startAt: wib("2030-01-12T10:00"),
      endAt: wib("2030-01-14T10:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "ONLINE",
      now,
    });
    expect(await expireOrders(wib("2030-01-10T11:01"))).toBe(1);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ status: "DIBATALKAN", cancelReason: "Batas waktu pembayaran terlewati." });
  });

  it("tidak membatalkan pesanan yang sudah lunas, walau paymentDueAt terlewati", async () => {
    const created = await orderOnline();
    vi.spyOn(midtrans, "createSnapTransaction").mockResolvedValue({ token: "t1", redirectUrl: "" });
    await startOnlinePayment(created.id, now);
    await db.payment.updateMany({ where: { orderId: created.id }, data: { status: "LUNAS" } });
    await db.order.update({ where: { id: created.id }, data: { status: "DIKONFIRMASI" } });

    expect(await expireOrders(wib("2030-01-10T11:01"))).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("DIKONFIRMASI");
  });

  it("bayar di toko yang belum dibayar dibatalkan setelah batas; yang sudah lunas dibiarkan", async () => {
    const items = [await createItem({ stock: 1 }), await createItem({ stock: 1 })];
    const orders = await Promise.all(
      items.map((item) =>
        createOrder({
          source: "ONLINE",
          userId: null,
          customerName: "Budi",
          customerPhone: "081234567890",
          items: [{ itemId: item.id, quantity: 1 }],
          startAt: wib("2030-01-11T09:00"), // < 24 jam dari now → batas bayar = waktu ambil
          endAt: wib("2030-01-12T09:00"),
          guaranteeType: "DEPOSIT",
          paymentMethod: "BAYAR_DI_TOKO",
          now,
        }),
      ),
    );
    await db.payment.create({
      data: { orderId: orders[1].id, purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: orders[1].totalDue, status: "LUNAS", paidAt: now },
    });

    expect(await expireOrders(wib("2030-01-11T09:01"))).toBe(1);
    const [a, b] = await Promise.all(orders.map((o) => db.order.findUniqueOrThrow({ where: { id: o.id } })));
    expect(a.status).toBe("DIBATALKAN");
    expect(b.status).toBe("DIKONFIRMASI");
  });

  it("stok bayar-di-toko yang kedaluwarsa lepas walau cron belum jalan (Req 8.7, design 6.4)", async () => {
    const item = await createItem({ stock: 1 });
    await createOrder({
      source: "ONLINE",
      userId: null,
      customerName: "Budi",
      customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }],
      startAt: wib("2030-01-11T09:00"),
      endAt: wib("2030-01-12T09:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now,
    });

    const later = await createOrder({
      source: "ONLINE",
      userId: null,
      customerName: "Sari",
      customerPhone: "081200000000",
      items: [{ itemId: item.id, quantity: 1 }],
      startAt: wib("2030-01-13T09:00"),
      endAt: wib("2030-01-14T09:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now: wib("2030-01-11T09:01"), // batas bayar pesanan pertama sudah lewat
    });
    expect(later.status).toBe("DIKONFIRMASI");
  });

  it("mengabaikan pesanan walk-in (tanpa batas bayar)", async () => {
    const item = await createItem();
    const order = await createOrder({
      source: "WALK_IN",
      userId: null,
      customerName: "Budi",
      customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }],
      startAt: now,
      endAt: wib("2030-01-11T10:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now,
    });
    expect(await expireOrders(wib("2030-02-01T10:00"))).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DIKONFIRMASI");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { cancelCustomerOrder, getCustomerOrder, listCustomerOrders } from "./customer-orders";
import { createOrder } from "./orders";

const now = wib("2030-01-10T10:00");
const USER_A = "user-a";
const USER_B = "user-b";

async function seedUser(id: string) {
  await db.user.create({ data: { id, name: id, email: `${id}@test.local` } });
}

async function orderFor(userId: string, overrides: Partial<Parameters<typeof createOrder>[0]> = {}) {
  const item = await createItem({ stock: 3, pricePerDay: 50_000, depositPerUnit: 100_000 });
  return createOrder({
    source: "ONLINE",
    userId,
    customerName: "Budi",
    customerPhone: "081234567890",
    items: [{ itemId: item.id, quantity: 1 }],
    startAt: wib("2030-01-12T10:00"),
    endAt: wib("2030-01-14T10:00"),
    guaranteeType: "DEPOSIT",
    paymentMethod: "BAYAR_DI_TOKO",
    now,
    ...overrides,
  });
}

beforeEach(async () => {
  await resetDatabase();
  await seedUser(USER_A);
  await seedUser(USER_B);
});

describe("listCustomerOrders (Req 9.1)", () => {
  it("hanya pesanan milik pengguna, terbaru dulu", async () => {
    await orderFor(USER_A, { now: wib("2030-01-09T10:00") });
    const newer = await orderFor(USER_A, { now: wib("2030-01-10T09:00") });
    await orderFor(USER_B);

    const orders = await listCustomerOrders(USER_A);
    expect(orders).toHaveLength(2);
    expect(orders[0].code).toBe(newer.code);
  });
});

describe("getCustomerOrder (Req 9.2)", () => {
  it("berisi rincian lengkap termasuk batas grace period", async () => {
    const created = await orderFor(USER_A);
    const order = await getCustomerOrder(USER_A, created.code, now);
    expect(order).toMatchObject({ code: created.code, status: "DIKONFIRMASI", rentalPaid: false, canCancel: true });
    expect(order.graceEndsAt).toEqual(wib("2030-01-14T22:00"));
    expect(order.items[0]).toMatchObject({ quantity: 1, lineTotal: 100_000 });
  });

  it("pesanan milik pengguna lain dijawab TIDAK_DITEMUKAN, bukan 403", async () => {
    const created = await orderFor(USER_B);
    await expect(getCustomerOrder(USER_A, created.code, now)).rejects.toMatchObject({ code: "TIDAK_DITEMUKAN" });
  });

  it("kode acak tidak membocorkan informasi", async () => {
    await expect(getCustomerOrder(USER_A, "HK-TIDAK-ADA", now)).rejects.toMatchObject({ code: "TIDAK_DITEMUKAN" });
  });

  it("menyegarkan status: pesanan bayar-di-toko yang kedaluwarsa otomatis DIBATALKAN", async () => {
    const created = await orderFor(USER_A, { startAt: wib("2030-01-11T09:00"), endAt: wib("2030-01-12T09:00") });
    const order = await getCustomerOrder(USER_A, created.code, wib("2030-01-11T09:01"));
    expect(order.status).toBe("DIBATALKAN");
  });
});

describe("cancelCustomerOrder (Req 9.3)", () => {
  it("pelanggan bisa batal sebelum lunas, dan melepas stoknya", async () => {
    const created = await orderFor(USER_A);
    await cancelCustomerOrder(USER_A, created.code, now);
    const order = await db.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(order).toMatchObject({ status: "DIBATALKAN", cancelReason: "Dibatalkan oleh pelanggan." });
  });

  it("pesanan yang sudah lunas tidak bisa dibatalkan sendiri", async () => {
    const created = await orderFor(USER_A);
    await db.payment.create({
      data: { orderId: created.id, purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue, status: "LUNAS", paidAt: now },
    });
    await expect(cancelCustomerOrder(USER_A, created.code, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });

  it("tidak bisa membatalkan pesanan milik pengguna lain", async () => {
    const created = await orderFor(USER_B);
    await expect(cancelCustomerOrder(USER_A, created.code, now)).rejects.toMatchObject({ code: "TIDAK_DITEMUKAN" });
    expect((await db.order.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("DIKONFIRMASI");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { getCustomerDetail, listCustomers } from "./customers";
import { returnOrder } from "./admin-orders";
import { createOrder } from "./orders";
import { pickupOrder, recordManualPayment } from "./admin-orders";

const ADMIN = { id: "admin-1", name: "Admin", email: "admin@test.local", role: "ADMIN" as const, phone: null };

async function seedAdmin() {
  await db.user.create({ data: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "ADMIN" } });
}
async function seedCustomer(id: string, name: string, email: string, phone = "081234567890") {
  return db.user.create({ data: { id, name, email, phone, role: "CUSTOMER" } });
}

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
});

describe("listCustomers (Req 15.1)", () => {
  it("hanya role CUSTOMER, tanpa filter mengembalikan semua", async () => {
    await seedCustomer("c1", "Sari Wulandari", "sari@test.local");
    const customers = await listCustomers();
    expect(customers.map((c) => c.id)).toEqual(["c1"]);
  });

  it("mencari berdasarkan nama, email, atau nomor HP", async () => {
    await seedCustomer("c1", "Sari Wulandari", "sari@test.local", "081234567890");
    await seedCustomer("c2", "Budi Santoso", "budi@test.local", "081298765432");
    expect((await listCustomers("sari")).map((c) => c.id)).toEqual(["c1"]);
    expect((await listCustomers("budi@test")).map((c) => c.id)).toEqual(["c2"]);
    expect((await listCustomers("0812-9876-5432")).map((c) => c.id)).toEqual(["c2"]);
  });

  it("menghitung jumlah pesanan dan total denda per pelanggan", async () => {
    const customer = await seedCustomer("c1", "Sari", "sari@test.local");
    const item = await createItem({ stock: 3, pricePerDay: 50_000, depositPerUnit: 100_000 });
    const order = await createOrder({
      source: "WALK_IN", userId: customer.id, customerName: customer.name, customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }], startAt: wib("2026-09-25T10:00"), endAt: wib("2026-09-27T10:00"),
      guaranteeType: "DEPOSIT", paymentMethod: "BAYAR_DI_TOKO", now: wib("2026-09-24T10:00"),
    });
    await recordManualPayment(order.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: order.totalDue }, wib("2026-09-25T10:00"));
    await pickupOrder(order.id, ADMIN, wib("2026-09-25T10:00"));
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] }); // telat 2 hari = 100.000

    const customers = await listCustomers();
    expect(customers[0]).toMatchObject({ orderCount: 1, totalFines: 100_000 });
  });
});

describe("getCustomerDetail (Req 15.2)", () => {
  it("berisi riwayat pesanan dan total denda", async () => {
    const customer = await seedCustomer("c1", "Sari", "sari@test.local");
    const item = await createItem({ stock: 3, pricePerDay: 50_000, depositPerUnit: 100_000 });
    await createOrder({
      source: "WALK_IN", userId: customer.id, customerName: customer.name, customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }], startAt: wib("2026-09-25T10:00"), endAt: wib("2026-09-27T10:00"),
      guaranteeType: "DEPOSIT", paymentMethod: "BAYAR_DI_TOKO", now: wib("2026-09-24T10:00"),
    });

    const detail = await getCustomerDetail(customer.id);
    expect(detail).toMatchObject({ name: "Sari", email: "sari@test.local", totalFines: 0 });
    expect(detail.orders).toHaveLength(1);
    expect(detail.orders[0]).toMatchObject({ status: "DIKONFIRMASI", totalDue: 200_000 });
  });

  it("pelanggan tidak ditemukan / bukan CUSTOMER → TIDAK_DITEMUKAN", async () => {
    await expect(getCustomerDetail("tidak-ada")).rejects.toMatchObject({ code: "TIDAK_DITEMUKAN" });
    await expect(getCustomerDetail(ADMIN.id)).rejects.toMatchObject({ code: "TIDAK_DITEMUKAN" }); // admin bukan pelanggan
  });
});

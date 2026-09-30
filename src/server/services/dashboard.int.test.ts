import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { pickupOrder, recordManualPayment, returnOrder } from "./admin-orders";
import { getDashboard } from "./dashboard";
import { createOrder } from "./orders";

const ADMIN = { id: "admin-1", name: "Admin", email: "admin@test.local", role: "ADMIN" as const, phone: null };
const period = { from: wib("2026-09-01T00:00"), to: wib("2026-09-30T23:59") };

async function seedAdmin() {
  await db.user.create({ data: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "ADMIN" } });
}

async function orderWith(overrides: Partial<Parameters<typeof createOrder>[0]> & { itemOverrides?: Parameters<typeof createItem>[0] } = {}) {
  const { itemOverrides, ...rest } = overrides;
  const item = await createItem({ stock: 5, pricePerDay: 50_000, depositPerUnit: 100_000, ...itemOverrides });
  return createOrder({
    source: "WALK_IN", userId: null, customerName: "Budi", customerPhone: "081234567890",
    items: [{ itemId: item.id, quantity: 1 }], startAt: wib("2026-09-10T10:00"), endAt: wib("2026-09-12T10:00"),
    guaranteeType: "DEPOSIT", paymentMethod: "BAYAR_DI_TOKO", now: wib("2026-09-09T10:00"),
    ...rest,
  });
}

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
});

describe("getDashboard (Req 16.1–16.3)", () => {
  it("pendapatan = rentalSubtotal (tidak dibatalkan) + denda dalam periode; deposit tidak dihitung", async () => {
    const order = await orderWith(); // rentalSubtotal 100.000, deposit 100.000
    await recordManualPayment(order.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: order.totalDue }, wib("2026-09-10T10:00"));
    await pickupOrder(order.id, ADMIN, wib("2026-09-10T10:00"));
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-13T12:00"), charges: [] }, wib("2026-09-13T12:00")); // endAt 12 Sep 10:00, telat 26 jam = 2 hari = 100.000

    const cancelled = await orderWith({ startAt: wib("2026-09-15T10:00"), endAt: wib("2026-09-16T10:00") });
    await db.order.update({ where: { id: cancelled.id }, data: { status: "DIBATALKAN" } });

    const data = await getDashboard(period, wib("2026-09-20T10:00"));
    expect(data.revenue).toMatchObject({ rental: 100_000, fines: 100_000, total: 200_000 });
  });

  it("statusCounts menjumlahkan semua pesanan (bukan hanya dalam periode)", async () => {
    await orderWith();
    await orderWith({ startAt: wib("2026-08-01T10:00"), endAt: wib("2026-08-02T10:00"), now: wib("2026-07-30T10:00") });
    const data = await getDashboard(period, wib("2026-09-20T10:00"));
    expect(data.statusCounts.DIKONFIRMASI).toBe(2);
  });

  it("itemsCurrentlyRented menjumlahkan unit dari pesanan DIAMBIL", async () => {
    const order = await orderWith();
    await recordManualPayment(order.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: order.totalDue }, wib("2026-09-10T10:00"));
    await pickupOrder(order.id, ADMIN, wib("2026-09-10T10:00"));
    const data = await getDashboard(period, wib("2026-09-11T10:00"));
    expect(data.itemsCurrentlyRented).toBe(1);
  });

  it("pickupsToday dan returnsToday memakai tanggal WIB", async () => {
    // startAt 10 Sep 03:00Z = 10 Sep 10:00 WIB
    const order = await orderWith({ startAt: wib("2026-09-10T10:00"), endAt: wib("2026-09-12T21:00") });
    const now = wib("2026-09-10T23:00"); // masih 10 Sep WIB
    const data = await getDashboard(period, now);
    expect(data.pickupsToday.map((o) => o.id)).toEqual([order.id]);

    const nowReturn = wib("2026-09-12T08:00"); // 12 Sep WIB, sebelum jatuh tempo 21:00
    const dataReturn = await getDashboard(period, nowReturn);
    // returnsToday hanya untuk status DIAMBIL
    expect(dataReturn.returnsToday).toEqual([]);
  });

  it("lateOrders hanya pesanan DIAMBIL yang sudah lewat grace period", async () => {
    const order = await orderWith({ startAt: wib("2026-09-08T10:00"), endAt: wib("2026-09-09T10:00"), now: wib("2026-09-07T10:00") });
    await recordManualPayment(order.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: order.totalDue }, wib("2026-09-08T10:00"));
    await pickupOrder(order.id, ADMIN, wib("2026-09-08T10:00"));

    const notYetLate = await getDashboard(period, wib("2026-09-09T20:00")); // masih dalam grace 12 jam
    expect(notYetLate.lateOrders).toEqual([]);

    const late = await getDashboard(period, wib("2026-09-10T10:00")); // lewat grace
    expect(late.lateOrders.map((o) => o.id)).toEqual([order.id]);
  });

  it("topItems: alat paling sering dipesan dalam periode, maksimal 5", async () => {
    const item = await createItem({ name: "Tenda Populer", stock: 10 });
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let i = 0; i < 3; i++) {
      await createOrder({
        source: "WALK_IN", userId: null, customerName: "Budi", customerPhone: "081234567890",
        items: [{ itemId: item.id, quantity: 2 }],
        startAt: wib(`2026-09-${pad(10 + i)}T10:00`),
        endAt: wib(`2026-09-${pad(11 + i)}T10:00`),
        guaranteeType: "DEPOSIT", paymentMethod: "BAYAR_DI_TOKO",
        now: wib(`2026-09-${pad(9 + i)}T10:00`),
      });
    }
    await orderWith(); // alat lain, 1 pesanan

    const data = await getDashboard(period, wib("2026-09-20T10:00"));
    expect(data.topItems[0]).toMatchObject({ name: "Tenda Populer", timesRented: 3, unitsRented: 6 });
  });

  it("defaultPeriod dan endpoint tidak error untuk toko baru tanpa pesanan", async () => {
    const data = await getDashboard(period);
    expect(data.revenue).toEqual({ rental: 0, fines: 0, total: 0 });
    expect(data.topItems).toEqual([]);
  });
});

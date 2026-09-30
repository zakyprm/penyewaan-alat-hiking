import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import {
  cancelOrderByAdmin,
  getAdminOrder,
  listAdminOrders,
  pickupOrder,
  recordManualPayment,
  updateGuaranteeStatus,
} from "./admin-orders";
import { createOrder } from "./orders";

const now = wib("2030-01-10T10:00");
const ADMIN = { id: "admin-1", name: "Admin", email: "admin@test.local", role: "ADMIN" as const, phone: null };

async function seedAdmin() {
  await db.user.create({ data: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "ADMIN" } });
}

async function orderWith(overrides: Partial<Parameters<typeof createOrder>[0]> = {}) {
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
    paymentMethod: "BAYAR_DI_TOKO",
    now,
    ...overrides,
  });
}

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
});

describe("listAdminOrders (Req 14.1, 14.2, 14.5)", () => {
  const emptyFilter = { from: undefined, to: undefined };

  it("filter status, sumber, dan metode bayar", async () => {
    await orderWith();
    await orderWith({ source: "WALK_IN" });
    const walkIns = await listAdminOrders({ ...emptyFilter, source: "WALK_IN" });
    expect(walkIns).toHaveLength(1);
    expect(walkIns[0].source).toBe("WALK_IN");
  });

  it("pencarian berdasarkan kode, nama, atau nomor HP", async () => {
    const created = await orderWith({ customerName: "Sari Wulandari", customerPhone: "081298765432" });
    expect((await listAdminOrders({ ...emptyFilter, q: created.code })).map((o) => o.id)).toEqual([created.id]);
    expect((await listAdminOrders({ ...emptyFilter, q: "sari wulan" })).map((o) => o.id)).toEqual([created.id]);
    expect((await listAdminOrders({ ...emptyFilter, q: "0812-9876-5432" })).map((o) => o.id)).toEqual([created.id]);
  });

  it("menandai terlambat dan dalam grace hanya untuk pesanan DIAMBIL", async () => {
    const late = await orderWith({
      source: "WALK_IN",
      startAt: wib("2030-01-08T10:00"),
      endAt: wib("2030-01-09T10:00"),
      now: wib("2030-01-08T10:00"), // dibuat saat itu juga (walk-in)
    });
    await db.order.update({ where: { id: late.id }, data: { status: "DIAMBIL", pickedUpAt: wib("2030-01-08T10:00") } });
    const orders = await listAdminOrders(emptyFilter, now);
    expect(orders.find((o) => o.id === late.id)?.timeliness).toBe("TERLAMBAT");
  });
});

describe("getAdminOrder & availableActions", () => {
  it("DIKONFIRMASI belum lunas: hanya bisa dibatalkan", async () => {
    const created = await orderWith();
    const order = await getAdminOrder(created.id);
    expect(order.availableActions).toEqual(["DIBATALKAN"]);
  });

  it("DIKONFIRMASI + lunas tapi KTP belum diterima: DIAMBIL belum tersedia (Req 7.7)", async () => {
    const created = await orderWith({ guaranteeType: "KTP" });
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    const order = await getAdminOrder(created.id);
    expect(order.availableActions).not.toContain("DIAMBIL");
    expect(order.guaranteeStatus).toBe("BELUM_DITERIMA");
  });

  it("DIKONFIRMASI + lunas + KTP diterima: DIAMBIL tersedia", async () => {
    const created = await orderWith({ guaranteeType: "KTP" });
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    await updateGuaranteeStatus(created.id, ADMIN, "RECEIVE", now);
    const order = await getAdminOrder(created.id);
    expect(order.availableActions).toContain("DIAMBIL");
  });
});

describe("recordManualPayment (Req 8.8)", () => {
  it("melunasi bayar-di-toko yang masih MENUNGGU_PEMBAYARAN otomatis DIKONFIRMASI", async () => {
    const item = await createItem({ stock: 1 });
    const created = await createOrder({
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
    // Status ONLINE dimulai MENUNGGU_PEMBAYARAN; admin mencatat bayar tunai di toko
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    const order = await db.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(order.status).toBe("DIKONFIRMASI");
  });

  it("mencatat denda tanpa mengubah status pesanan", async () => {
    const created = await orderWith();
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    await recordManualPayment(created.id, ADMIN, { purpose: "DENDA", channel: "TUNAI", amount: 20_000 }, now);
    const order = await getAdminOrder(created.id);
    expect(order.status).toBe("DIKONFIRMASI");
    expect(order.payments).toHaveLength(2);
  });
});

describe("updateGuaranteeStatus (Req 7.6, 7.7)", () => {
  it("terima lalu kembalikan KTP secara berurutan", async () => {
    const created = await orderWith({ guaranteeType: "KTP" });
    await updateGuaranteeStatus(created.id, ADMIN, "RECEIVE", now);
    let order = await getAdminOrder(created.id);
    expect(order.guaranteeStatus).toBe("DITERIMA");

    await updateGuaranteeStatus(created.id, ADMIN, "RETURN", now);
    order = await getAdminOrder(created.id);
    expect(order.guaranteeStatus).toBe("DIKEMBALIKAN");
  });

  it("tidak bisa dikembalikan sebelum diterima", async () => {
    const created = await orderWith({ guaranteeType: "KTP" });
    await expect(updateGuaranteeStatus(created.id, ADMIN, "RETURN", now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });

  it("menolak untuk pesanan berjaminan deposit", async () => {
    const created = await orderWith({ guaranteeType: "DEPOSIT" });
    await expect(updateGuaranteeStatus(created.id, ADMIN, "RECEIVE", now)).rejects.toMatchObject({ code: "VALIDASI_GAGAL" });
  });
});

describe("pickupOrder (Req 7.7, 14.3)", () => {
  it("ditolak jika belum lunas", async () => {
    const created = await orderWith();
    await expect(pickupOrder(created.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });

  it("ditolak jika jaminan KTP belum diterima, walau sudah lunas", async () => {
    const created = await orderWith({ guaranteeType: "KTP" });
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    await expect(pickupOrder(created.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });

  it("berhasil setelah lunas dan (jika KTP) sudah diterima", async () => {
    const created = await orderWith({ guaranteeType: "KTP" });
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    await updateGuaranteeStatus(created.id, ADMIN, "RECEIVE", now);
    await pickupOrder(created.id, ADMIN, now);
    const order = await db.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(order).toMatchObject({ status: "DIAMBIL" });
    expect(order.pickedUpAt).toEqual(now);
  });
});

describe("cancelOrderByAdmin (Req 14.3, 14.4)", () => {
  it("admin bisa membatalkan pesanan yang sudah lunas (butuh refund manual terpisah)", async () => {
    const created = await orderWith();
    await recordManualPayment(created.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: created.totalDue }, now);
    await cancelOrderByAdmin(created.id, ADMIN, "Alat rusak sebelum diambil", now);
    const order = await getAdminOrder(created.id);
    expect(order).toMatchObject({ status: "DIBATALKAN", cancelReason: "Alat rusak sebelum diambil" });
    const statusEvent = order.events.find((e) => e.type === "STATUS_CHANGED");
    expect(statusEvent).toMatchObject({ actorId: ADMIN.id, data: { from: "DIKONFIRMASI", to: "DIBATALKAN" } });
  });

  it("tidak bisa membatalkan pesanan yang sudah SELESAI", async () => {
    const created = await orderWith();
    await db.order.update({ where: { id: created.id }, data: { status: "SELESAI" } });
    await expect(cancelOrderByAdmin(created.id, ADMIN, "coba batal", now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });
});

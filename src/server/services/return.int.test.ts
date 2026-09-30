import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import {
  cancelOrderByAdmin,
  completeOrder,
  getSettlementPreview,
  pickupOrder,
  recordManualPayment,
  returnOrder,
  updateGuaranteeStatus,
} from "./admin-orders";
import { createOrder } from "./orders";

const now = wib("2030-01-10T10:00");
const ADMIN = { id: "admin-1", name: "Admin", email: "admin@test.local", role: "ADMIN" as const, phone: null };

async function seedAdmin() {
  await db.user.create({ data: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "ADMIN" } });
}

/** Pesanan yang sudah DIAMBIL, siap untuk dikembalikan. Jatuh tempo Minggu 27 Sep 2026 10.00 WIB. */
async function pickedUpOrder(overrides: { guaranteeType?: "DEPOSIT" | "KTP"; pricePerDay?: number; depositPerUnit?: number; quantity?: number } = {}) {
  const item = await createItem({ stock: 3, pricePerDay: overrides.pricePerDay ?? 50_000, depositPerUnit: overrides.depositPerUnit ?? 100_000 });
  const order = await createOrder({
    source: "WALK_IN",
    userId: null,
    customerName: "Budi",
    customerPhone: "081234567890",
    items: [{ itemId: item.id, quantity: overrides.quantity ?? 1 }],
    startAt: wib("2026-09-25T10:00"),
    endAt: wib("2026-09-27T10:00"),
    guaranteeType: overrides.guaranteeType ?? "DEPOSIT",
    paymentMethod: "BAYAR_DI_TOKO",
    now: wib("2026-09-24T10:00"),
  });
  await recordManualPayment(order.id, ADMIN, { purpose: "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: order.totalDue }, now);
  if ((overrides.guaranteeType ?? "DEPOSIT") === "KTP") await updateGuaranteeStatus(order.id, ADMIN, "RECEIVE", now);
  await pickupOrder(order.id, ADMIN, now);
  return order;
}

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
});

describe("returnOrder (Req 11.1–11.3)", () => {
  it("tepat waktu: tidak ada denda telat", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-27T20:00"), charges: [] });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { charges: true } });
    expect(saved.status).toBe("DIKEMBALIKAN");
    expect(saved.returnedAt).toEqual(wib("2026-09-27T20:00"));
    expect(saved.charges).toHaveLength(0);
  });

  it("terlambat 26 jam (Rp50.000/hari): denda TELAT Rp100.000 tercatat otomatis", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] });
    const charges = await db.orderCharge.findMany({ where: { orderId: order.id } });
    expect(charges).toEqual([expect.objectContaining({ type: "TELAT", amount: 100_000 })]);
  });

  it("denda kerusakan manual ditambahkan bersama denda telat", async () => {
    const order = await pickedUpOrder();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await returnOrder(order.id, ADMIN, {
      returnedAt: wib("2026-09-28T12:00"),
      charges: [{ type: "KERUSAKAN", orderItemId: item.id, amount: 30_000, note: "Ritsleting rusak" }],
    });
    const charges = await db.orderCharge.findMany({ where: { orderId: order.id } });
    expect(charges.map((c) => `${c.type}:${c.amount}`).toSorted()).toEqual(["KERUSAKAN:30000", "TELAT:100000"]);
  });

  it("menolak orderItemId yang tidak ada pada pesanan", async () => {
    const order = await pickedUpOrder();
    await expect(
      returnOrder(order.id, ADMIN, { returnedAt: now, charges: [{ type: "KERUSAKAN", orderItemId: "tidak-ada", amount: 1000, note: "x" }] }),
    ).rejects.toMatchObject({ code: "VALIDASI_GAGAL" });
  });

  it("hanya bisa dari DIAMBIL", async () => {
    const item = await createItem();
    const order = await createOrder({
      source: "WALK_IN", userId: null, customerName: "Budi", customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }], startAt: wib("2026-09-25T10:00"), endAt: wib("2026-09-27T10:00"),
      guaranteeType: "DEPOSIT", paymentMethod: "BAYAR_DI_TOKO", now: wib("2026-09-24T10:00"),
    });
    await expect(returnOrder(order.id, ADMIN, { charges: [] })).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });

  it("default returnedAt = sekarang jika tidak diisi", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { charges: [] }, wib("2026-09-27T15:00"));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).returnedAt).toEqual(wib("2026-09-27T15:00"));
  });
});

describe("getSettlementPreview & completeOrder (Req 11.4–11.6)", () => {
  it("deposit: tepat waktu → refund penuh", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-27T20:00"), charges: [] });
    const preview = await getSettlementPreview(order.id);
    expect(preview).toMatchObject({ depositTotal: 100_000, totalCharges: 0, refund: 100_000, amountToCollect: 0, coveredByDeposit: 0 });
  });

  it("deposit: denda lebih kecil dari deposit → sebagian dikembalikan", async () => {
    const order = await pickedUpOrder(); // deposit 100.000
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T09:00"), charges: [] }); // telat 23 jam = 1 hari = 50.000
    const preview = await getSettlementPreview(order.id);
    expect(preview).toMatchObject({ totalCharges: 50_000, refund: 50_000, amountToCollect: 0 });
  });

  it("deposit: denda melebihi deposit → kekurangan ditagih", async () => {
    const order = await pickedUpOrder({ depositPerUnit: 30_000 });
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] }); // telat 2 hari = 100.000
    const preview = await getSettlementPreview(order.id);
    expect(preview).toMatchObject({ depositTotal: 30_000, totalCharges: 100_000, refund: 0, amountToCollect: 70_000, coveredByDeposit: 30_000 });
  });

  it("KTP: seluruh denda ditagih langsung, tidak ada refund", async () => {
    const order = await pickedUpOrder({ guaranteeType: "KTP" });
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] });
    const preview = await getSettlementPreview(order.id);
    expect(preview).toMatchObject({ totalCharges: 100_000, refund: 0, amountToCollect: 100_000 });
  });

  it("completeOrder ditolak jika masih ada denda belum lunas", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T09:00"), charges: [] });
    await expect(completeOrder(order.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });

  it("deposit: setelah refund dicatat, SELESAI berhasil", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-27T20:00"), charges: [] }); // tanpa denda
    await recordManualPayment(order.id, ADMIN, { purpose: "REFUND_DEPOSIT", channel: "TUNAI", amount: 100_000 }, now);
    await completeOrder(order.id, ADMIN, now);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SELESAI");
  });

  it("deposit: denda lunas via DENDA payment lalu SELESAI, tanpa perlu refund (sisa 0)", async () => {
    const order = await pickedUpOrder(); // deposit 100.000
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] }); // denda 100.000 = deposit
    // sisa deposit = 0, jadi depositSettled true tanpa payment REFUND_DEPOSIT (lihat depositSettledOf)
    await completeOrder(order.id, ADMIN, now);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SELESAI");
  });

  it("deposit: kekurangan harus lunas dulu sebelum SELESAI", async () => {
    const order = await pickedUpOrder({ depositPerUnit: 30_000 });
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] }); // denda 100.000, deposit 30.000, kurang 70.000
    await expect(completeOrder(order.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
    await recordManualPayment(order.id, ADMIN, { purpose: "DENDA", channel: "TUNAI", amount: 70_000 }, now);
    await completeOrder(order.id, ADMIN, now);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SELESAI");
  });

  it("KTP: SELESAI butuh denda lunas dan KTP dikembalikan", async () => {
    const order = await pickedUpOrder({ guaranteeType: "KTP" });
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-28T12:00"), charges: [] }); // denda 100.000
    await expect(completeOrder(order.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });

    await recordManualPayment(order.id, ADMIN, { purpose: "DENDA", channel: "TUNAI", amount: 100_000 }, now);
    await expect(completeOrder(order.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" }); // KTP belum dikembalikan

    await updateGuaranteeStatus(order.id, ADMIN, "RETURN", now);
    await completeOrder(order.id, ADMIN, now);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { guarantee: true } });
    expect(saved.status).toBe("SELESAI");
    expect(saved.guarantee?.status).toBe("DIKEMBALIKAN");
  });

  it("KTP: tanpa denda tetap butuh KTP dikembalikan sebelum SELESAI", async () => {
    const order = await pickedUpOrder({ guaranteeType: "KTP" });
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-27T20:00"), charges: [] }); // tepat waktu
    await expect(completeOrder(order.id, ADMIN, now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
    await updateGuaranteeStatus(order.id, ADMIN, "RETURN", now);
    await completeOrder(order.id, ADMIN, now);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SELESAI");
  });

  it("admin bisa membatalkan pesanan SELESAI? tidak — transisi tidak terdaftar", async () => {
    const order = await pickedUpOrder();
    await returnOrder(order.id, ADMIN, { returnedAt: wib("2026-09-27T20:00"), charges: [] });
    await recordManualPayment(order.id, ADMIN, { purpose: "REFUND_DEPOSIT", channel: "TUNAI", amount: 100_000 }, now);
    await completeOrder(order.id, ADMIN, now);
    await expect(cancelOrderByAdmin(order.id, ADMIN, "coba batal", now)).rejects.toMatchObject({ code: "TRANSISI_TIDAK_VALID" });
  });
});

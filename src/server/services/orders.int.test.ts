import { beforeEach, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/errors";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { getAvailability } from "./availability";
import { createOrder, type CreateOrderInput } from "./orders";

const now = wib("2030-01-10T10:00"); // Kamis
const window = { start: wib("2030-01-12T10:00"), end: wib("2030-01-14T10:00") };

/** Pesanan langsung di database dengan status tertentu, untuk menyiapkan kondisi test. */
async function insertOrder(opts: {
  itemId: string;
  quantity: number;
  start: Date;
  end: Date;
  status: OrderStatus;
  paymentDueAt?: Date | null;
}) {
  return db.order.create({
    data: {
      code: `T-${Math.random().toString(36).slice(2)}`,
      source: "ONLINE",
      customerName: "Uji",
      customerPhone: "081234567890",
      startAt: opts.start,
      endAt: opts.end,
      rentalDays: 1,
      status: opts.status,
      paymentMethod: "ONLINE",
      guaranteeType: "DEPOSIT",
      rentalSubtotal: 0,
      depositTotal: 0,
      graceHours: 12,
      lateFinePercent: 100,
      paymentDueAt: opts.paymentDueAt ?? null,
      items: {
        create: { itemId: opts.itemId, itemName: "x", quantity: opts.quantity, pricePerDay: 0, depositPerUnit: 0, lineTotal: 0 },
      },
    },
  });
}

const available = async (itemId: string, w = window) => (await getAvailability([itemId], w, { now })).get(itemId)!;

function baseInput(itemId: string, overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    source: "ONLINE",
    userId: null,
    customerName: "Budi",
    customerPhone: "081234567890",
    items: [{ itemId, quantity: 1 }],
    startAt: window.start,
    endAt: window.end,
    guaranteeType: "DEPOSIT",
    paymentMethod: "BAYAR_DI_TOKO",
    now,
    ...overrides,
  };
}

async function expectDomainError(promise: Promise<unknown>, code: DomainError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  return error as DomainError;
}

beforeEach(resetDatabase);

describe("ketersediaan per tanggal (Req 5.1–5.3)", () => {
  it("tanpa pesanan: tersedia = stok", async () => {
    const item = await createItem({ stock: 3 });
    expect(await available(item.id)).toMatchObject({ stock: 3, reserved: 0, available: 3 });
  });

  it("pesanan yang beririsan mengurangi, yang bersambung tidak", async () => {
    const item = await createItem({ stock: 3 });
    await insertOrder({ itemId: item.id, quantity: 2, start: wib("2030-01-13T10:00"), end: wib("2030-01-15T10:00"), status: "DIKONFIRMASI" });
    await insertOrder({ itemId: item.id, quantity: 1, start: wib("2030-01-14T10:00"), end: wib("2030-01-16T10:00"), status: "DIKONFIRMASI" });
    // pesanan kedua mulai tepat saat rentang kita selesai → tidak beririsan
    expect((await available(item.id)).available).toBe(1);
  });

  it("memakai puncak pemakaian, bukan jumlah semua pesanan", async () => {
    const item = await createItem({ stock: 3 });
    // Dua pesanan di dalam rentang yang tidak saling bertemu: puncaknya 2, bukan 4
    await insertOrder({ itemId: item.id, quantity: 2, start: wib("2030-01-12T10:00"), end: wib("2030-01-13T08:00"), status: "DIKONFIRMASI" });
    await insertOrder({ itemId: item.id, quantity: 2, start: wib("2030-01-13T10:00"), end: wib("2030-01-14T10:00"), status: "DIAMBIL" });
    expect(await available(item.id)).toMatchObject({ reserved: 2, available: 1 });
  });

  it("MENUNGGU_PEMBAYARAN hanya menahan stok sebelum kedaluwarsa", async () => {
    const item = await createItem({ stock: 1 });
    const pending = { itemId: item.id, quantity: 1, start: window.start, end: window.end, status: "MENUNGGU_PEMBAYARAN" as const };
    await insertOrder({ ...pending, paymentDueAt: wib("2030-01-10T09:00") }); // sudah lewat
    expect((await available(item.id)).available).toBe(1);
    await insertOrder({ ...pending, paymentDueAt: wib("2030-01-10T11:00") }); // belum lewat
    expect((await available(item.id)).available).toBe(0);
  });

  it("pesanan selesai/batal/dikembalikan tidak menahan stok", async () => {
    const item = await createItem({ stock: 1 });
    for (const status of ["SELESAI", "DIBATALKAN", "DIKEMBALIKAN"] as const) {
      await insertOrder({ itemId: item.id, quantity: 1, start: window.start, end: window.end, status });
    }
    expect((await available(item.id)).available).toBe(1);
  });

  it("alat DIAMBIL yang telat kembali tidak tersedia untuk waktu mana pun sampai dikembalikan (Req 5.3)", async () => {
    const item = await createItem({ stock: 1 });
    // Jatuh tempo kemarin, belum dikembalikan
    const late = await insertOrder({
      itemId: item.id,
      quantity: 1,
      start: wib("2030-01-07T10:00"),
      end: wib("2030-01-09T10:00"),
      status: "DIAMBIL",
    });
    expect((await available(item.id, { start: wib("2030-01-10T12:00"), end: wib("2030-01-11T12:00") })).available).toBe(0);
    expect((await available(item.id, { start: wib("2030-02-01T10:00"), end: wib("2030-02-02T10:00") })).available).toBe(0);
    await expectDomainError(createOrder(baseInput(item.id)), "STOK_TIDAK_CUKUP");

    // Setelah dikembalikan, langsung tersedia lagi
    await db.order.update({ where: { id: late.id }, data: { status: "DIKEMBALIKAN", returnedAt: now } });
    expect((await available(item.id)).available).toBe(1);
  });

  it("alat DIAMBIL yang belum jatuh tempo hanya menahan sampai jatuh temponya", async () => {
    const item = await createItem({ stock: 1 });
    await insertOrder({ itemId: item.id, quantity: 1, start: wib("2030-01-09T10:00"), end: wib("2030-01-11T10:00"), status: "DIAMBIL" });
    expect((await available(item.id)).available).toBe(1); // window mulai 12 Jan
  });
});

describe("createOrder", () => {
  it("menyimpan snapshot harga, kebijakan, jaminan, dan riwayat", async () => {
    const item = await createItem({ stock: 5, pricePerDay: 35_000, depositPerUnit: 100_000 });
    const order = await createOrder(baseInput(item.id, { items: [{ itemId: item.id, quantity: 2 }] }));

    expect(order.code).toBe("HK-300110-0001");
    expect(order).toMatchObject({
      status: "DIKONFIRMASI",
      rentalDays: 2,
      rentalSubtotal: 140_000,
      depositTotal: 200_000,
      totalDue: 340_000,
    });
    // Bayar di toko: 24 jam sebelum waktu ambil
    expect(order.paymentDueAt).toEqual(wib("2030-01-11T10:00"));

    // Harga alat berubah setelahnya tidak memengaruhi pesanan (Req 6.5)
    await db.item.update({ where: { id: item.id }, data: { pricePerDay: 99_000 } });
    await db.setting.update({ where: { id: 1 }, data: { graceHours: 2 } });
    const saved = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, guarantee: true, events: true },
    });
    expect(saved.items[0]).toMatchObject({ pricePerDay: 35_000, depositPerUnit: 100_000, quantity: 2, lineTotal: 140_000 });
    expect(saved.graceHours).toBe(12);
    expect(saved.lateFinePercent).toBe(100);
    expect(saved.guarantee).toMatchObject({ type: "DEPOSIT", status: "BELUM_DITERIMA" });
    expect(saved.events.map((e) => e.type)).toEqual(["ORDER_CREATED"]);
  });

  it("bayar online → MENUNGGU_PEMBAYARAN dengan batas 60 menit", async () => {
    const item = await createItem();
    const order = await createOrder(baseInput(item.id, { paymentMethod: "ONLINE" }));
    expect(order.status).toBe("MENUNGGU_PEMBAYARAN");
    expect(order.paymentDueAt).toEqual(wib("2030-01-10T11:00"));
  });

  it("jaminan KTP → deposit 0", async () => {
    const item = await createItem();
    const order = await createOrder(baseInput(item.id, { guaranteeType: "KTP" }));
    expect(order.depositTotal).toBe(0);
    expect(order.totalDue).toBe(order.rentalSubtotal);
  });

  it("kode pesanan berurutan per hari", async () => {
    const item = await createItem({ stock: 10 });
    const a = await createOrder(baseInput(item.id));
    const b = await createOrder(baseInput(item.id));
    const c = await createOrder(baseInput(item.id, { now: wib("2030-01-11T09:00") }));
    expect([a.code, b.code, c.code]).toEqual(["HK-300110-0001", "HK-300110-0002", "HK-300111-0001"]);
  });

  it("menolak jika stok tidak cukup, beserta detailnya", async () => {
    const item = await createItem({ name: "Tenda Uji", stock: 2 });
    await createOrder(baseInput(item.id));
    const error = await expectDomainError(
      createOrder(baseInput(item.id, { items: [{ itemId: item.id, quantity: 2 }] })),
      "STOK_TIDAK_CUKUP",
    );
    expect(error.details).toEqual([{ itemId: item.id, name: "Tenda Uji", requested: 2, available: 1 }]);
    expect(await db.order.count()).toBe(1); // transaksi dibatalkan, tidak ada sisa data
  });

  it("alat internal tidak bisa dipesan online, tapi bisa walk-in (Req 3.5, 13.3)", async () => {
    const item = await createItem({ visibility: "INTERNAL" });
    await expectDomainError(createOrder(baseInput(item.id)), "TIDAK_DITEMUKAN");
    const order = await createOrder(baseInput(item.id, { source: "WALK_IN", startAt: now, endAt: wib("2030-01-11T10:00") }));
    expect(order.status).toBe("DIKONFIRMASI");
    expect(order.paymentDueAt).toBeNull();
  });

  it("alat nonaktif atau terhapus tidak bisa dipesan", async () => {
    const inactive = await createItem({ isActive: false });
    await expectDomainError(createOrder(baseInput(inactive.id)), "TIDAK_DITEMUKAN");
    const deleted = await createItem();
    await db.item.update({ where: { id: deleted.id }, data: { deletedAt: now } });
    await expectDomainError(createOrder(baseInput(deleted.id)), "TIDAK_DITEMUKAN");
  });

  it("jaminan KTP ditolak untuk alat yang tidak mengizinkan (Req 7.3)", async () => {
    const item = await createItem({ allowKtp: false });
    await expectDomainError(createOrder(baseInput(item.id, { guaranteeType: "KTP" })), "JAMINAN_TIDAK_DIIZINKAN");
  });

  it("jaminan yang dinonaktifkan admin ditolak (Req 7.2)", async () => {
    const item = await createItem();
    await db.setting.update({ where: { id: 1 }, data: { depositEnabled: false } });
    await expectDomainError(createOrder(baseInput(item.id)), "JAMINAN_TIDAK_DIIZINKAN");
  });

  it("menolak waktu di luar jam operasional (Req 17.3)", async () => {
    const item = await createItem();
    await expectDomainError(
      createOrder(baseInput(item.id, { startAt: wib("2030-01-12T06:00") })),
      "DI_LUAR_JAM_OPERASIONAL",
    );
  });

  it("baris duplikat untuk alat yang sama dijumlahkan", async () => {
    const item = await createItem({ stock: 3 });
    const order = await createOrder(
      baseInput(item.id, { items: [{ itemId: item.id, quantity: 1 }, { itemId: item.id, quantity: 2 }] }),
    );
    expect(order.items).toEqual([expect.objectContaining({ itemId: item.id, quantity: 3 })]);
  });
});

describe("mencegah double booking (Req 5.4)", () => {
  it("dari 8 pesanan bersamaan untuk unit terakhir, hanya 1 yang berhasil", async () => {
    const item = await createItem({ stock: 1 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createOrder(baseInput(item.id))));

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed.every((r) => r.reason instanceof DomainError && r.reason.code === "STOK_TIDAK_CUKUP")).toBe(true);
    expect(await db.order.count()).toBe(1);
    expect((await available(item.id)).available).toBe(0);
  });

  it("pesanan bersamaan dengan urutan alat berbeda tidak deadlock", async () => {
    const a = await createItem({ stock: 10 });
    const b = await createItem({ stock: 10 });
    const orders = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        createOrder(
          baseInput(a.id, {
            items:
              i % 2 === 0
                ? [{ itemId: a.id, quantity: 1 }, { itemId: b.id, quantity: 1 }]
                : [{ itemId: b.id, quantity: 1 }, { itemId: a.id, quantity: 1 }],
          }),
        ),
      ),
    );
    expect(new Set(orders.map((o) => o.code)).size).toBe(6);
    expect((await available(a.id)).available).toBe(4);
  });
});

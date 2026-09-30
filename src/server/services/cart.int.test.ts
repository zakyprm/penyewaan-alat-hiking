import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { quoteCart } from "./cart";
import { createOrder } from "./orders";

const now = wib("2030-01-10T10:00");
const window = { startAt: wib("2030-01-12T10:00"), endAt: wib("2030-01-14T10:00") };

beforeEach(resetDatabase);

describe("quoteCart (Req 4.2, 4.3)", () => {
  it("menghitung dari harga database, bukan dari keranjang", async () => {
    const tenda = await createItem({ stock: 5, pricePerDay: 50_000, depositPerUnit: 100_000 });
    const carrier = await createItem({ stock: 5, pricePerDay: 25_000, depositPerUnit: 75_000 });
    const q = await quoteCart(
      { ...window, items: [{ itemId: tenda.id, quantity: 1 }, { itemId: carrier.id, quantity: 2 }] },
      now,
    );
    expect(q).toMatchObject({ days: 2, rentalSubtotal: 200_000, depositTotal: 250_000, canCheckout: true, windowIssue: null });
    expect(q.lines.map((l) => [l.status, l.available, l.lineTotal])).toEqual([
      ["TERSEDIA", 5, 100_000],
      ["TERSEDIA", 5, 100_000],
    ]);
  });

  it("menandai stok kurang setelah waktu diubah", async () => {
    const item = await createItem({ stock: 2 });
    await createOrder({
      source: "ONLINE",
      userId: null,
      customerName: "Budi",
      customerPhone: "081234567890",
      items: [{ itemId: item.id, quantity: 1 }],
      startAt: wib("2030-01-13T10:00"),
      endAt: wib("2030-01-15T10:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now,
    });
    const q = await quoteCart({ ...window, items: [{ itemId: item.id, quantity: 2 }] }, now);
    expect(q.lines[0]).toMatchObject({ status: "STOK_KURANG", available: 1 });
    expect(q.canCheckout).toBe(false);
  });

  it("alat yang jadi internal atau dihapus → TIDAK_TERSEDIA, tidak ikut dihitung", async () => {
    const ok = await createItem({ pricePerDay: 10_000 });
    const internal = await createItem({ visibility: "INTERNAL" });
    const q = await quoteCart(
      { ...window, items: [{ itemId: ok.id, quantity: 1 }, { itemId: internal.id, quantity: 1 }, { itemId: "hilang", quantity: 1 }] },
      now,
    );
    expect(q.lines.map((l) => l.status)).toEqual(["TERSEDIA", "TIDAK_TERSEDIA", "TIDAK_TERSEDIA"]);
    expect(q.lines[1].item).toBeNull();
    expect(q.rentalSubtotal).toBe(20_000);
    expect(q.canCheckout).toBe(false);
  });

  it("waktu di luar jam operasional → windowIssue, stok belum dicek", async () => {
    const item = await createItem();
    const q = await quoteCart({ startAt: wib("2030-01-12T22:00"), endAt: window.endAt, items: [{ itemId: item.id, quantity: 1 }] }, now);
    expect(q.windowIssue?.code).toBe("DI_LUAR_JAM_OPERASIONAL");
    expect(q.lines[0]).toMatchObject({ status: "BELUM_DICEK", available: null });
    expect(q.canCheckout).toBe(false);
  });

  it("opsi jaminan: KTP tidak tersedia jika ada alat yang tidak mengizinkan (Req 7.3)", async () => {
    const a = await createItem({ name: "Tenda Biasa" });
    const b = await createItem({ name: "Tenda Mahal", allowKtp: false });
    const q = await quoteCart({ ...window, items: [{ itemId: a.id, quantity: 1 }, { itemId: b.id, quantity: 1 }] }, now);
    const ktp = q.guaranteeOptions.find((o) => o.type === "KTP")!;
    expect(ktp).toMatchObject({ available: false, blockingItems: ["Tenda Mahal"] });
    expect(q.canCheckout).toBe(true); // deposit masih bisa

    await db.setting.update({ where: { id: 1 }, data: { depositEnabled: false } });
    expect((await quoteCart({ ...window, items: [{ itemId: b.id, quantity: 1 }] }, now)).canCheckout).toBe(false);
  });
});

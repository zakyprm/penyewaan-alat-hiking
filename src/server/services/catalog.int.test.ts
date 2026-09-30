import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import { catalogQuerySchema } from "@/lib/validation/catalog-query";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { getCatalogAvailability, getCatalogItem, listCatalog, listCatalogCategories } from "./catalog";
import { createOrder } from "./orders";

const now = wib("2030-01-10T10:00");
const q = (params: Record<string, string> = {}) => catalogQuerySchema.parse(params);

beforeEach(resetDatabase);

describe("listCatalog (Req 2)", () => {
  it("hanya alat publik, aktif, dan belum dihapus", async () => {
    const pub = await createItem({ name: "Tenda Publik" });
    await createItem({ name: "Kursi Internal", visibility: "INTERNAL" });
    await createItem({ name: "Tenda Nonaktif", isActive: false });
    const deleted = await createItem({ name: "Tenda Dihapus" });
    await db.item.update({ where: { id: deleted.id }, data: { deletedAt: now } });

    const page = await listCatalog(q(), now);
    expect(page.items.map((i) => i.id)).toEqual([pub.id]);
  });

  it("pencarian nama tidak peka huruf besar, filter harga, dan urutan", async () => {
    await createItem({ name: "Tenda Dome", pricePerDay: 50_000 });
    await createItem({ name: "tenda ultralight", pricePerDay: 45_000 });
    await createItem({ name: "Carrier", pricePerDay: 25_000 });

    expect((await listCatalog(q({ q: "TENDA" }), now)).total).toBe(2);
    const cheap = await listCatalog(q({ maxPrice: "46000", sort: "termurah" }), now);
    expect(cheap.items.map((i) => i.pricePerDay)).toEqual([25_000, 45_000]);
    // Harga kosong dari form GET diabaikan, bukan dianggap 0
    expect((await listCatalog(q({ minPrice: "", maxPrice: "" }), now)).total).toBe(3);
  });

  it("filter kategori memakai slug", async () => {
    const item = await createItem();
    const category = await db.category.findUniqueOrThrow({ where: { id: item.categoryId } });
    await createItem();
    const page = await listCatalog(q({ category: category.slug }), now);
    expect(page.items.map((i) => i.id)).toEqual([item.id]);
  });

  it("filter tanggal hanya menampilkan alat yang tersedia minimal 1 unit (Req 2.4)", async () => {
    const full = await createItem({ name: "A Penuh", stock: 1 });
    const free = await createItem({ name: "B Tersedia", stock: 1 });
    await createOrder({
      source: "ONLINE",
      userId: null,
      customerName: "Budi",
      customerPhone: "081234567890",
      items: [{ itemId: full.id, quantity: 1 }],
      startAt: wib("2030-01-12T10:00"),
      endAt: wib("2030-01-14T10:00"),
      guaranteeType: "DEPOSIT",
      paymentMethod: "BAYAR_DI_TOKO",
      now,
    });

    const during = await listCatalog(q({ start: "2030-01-13T10:00", end: "2030-01-15T10:00" }), now);
    expect(during.items.map((i) => i.id)).toEqual([free.id]);
    const after = await listCatalog(q({ start: "2030-01-14T10:00", end: "2030-01-15T10:00" }), now);
    expect(after.total).toBe(2);
    // Urutan waktu terbalik → filter tanggal diabaikan
    const reversed = await listCatalog(q({ start: "2030-01-15T10:00", end: "2030-01-13T10:00" }), now);
    expect(reversed.total).toBe(2);
  });

  it("paginasi 12 per halaman, halaman berlebih jatuh ke halaman terakhir", async () => {
    for (let i = 0; i < 14; i++) await createItem({ name: `Alat ${String(i).padStart(2, "0")}` });
    const p2 = await listCatalog(q({ page: "2" }), now);
    expect(p2).toMatchObject({ total: 14, page: 2, totalPages: 2 });
    expect(p2.items).toHaveLength(2);
    expect((await listCatalog(q({ page: "99" }), now)).page).toBe(2);
    expect((await listCatalog(q({ page: "abc" }), now)).page).toBe(1);
  });
});

describe("detail dan ketersediaan (Req 3)", () => {
  it("alat internal dan nonaktif → TIDAK_DITEMUKAN", async () => {
    const internal = await createItem({ visibility: "INTERNAL" });
    const inactive = await createItem({ isActive: false });
    for (const item of [internal, inactive]) {
      await expect(getCatalogItem(item.slug)).rejects.toMatchObject({ code: "TIDAK_DITEMUKAN" });
    }
  });

  it("ketersediaan memvalidasi waktu seperti checkout", async () => {
    const item = await createItem({ stock: 3 });
    const ok = await getCatalogAvailability(item.slug, { start: wib("2030-01-12T10:00"), end: wib("2030-01-13T12:00") }, now);
    expect(ok).toMatchObject({ available: 3, stock: 3, rentalDays: 2 });

    const error = await getCatalogAvailability(
      item.slug,
      { start: wib("2030-01-12T22:00"), end: wib("2030-01-13T10:00") },
      now,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("DI_LUAR_JAM_OPERASIONAL");
  });

  it("kategori hanya yang punya alat publik", async () => {
    const pub = await createItem();
    await createItem({ visibility: "INTERNAL" });
    const categories = await listCatalogCategories();
    expect(categories.map((c) => c.id)).toEqual([pub.categoryId]);
  });
});

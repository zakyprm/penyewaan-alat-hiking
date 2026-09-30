import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { rentalDays } from "@/lib/domain/pricing";
import { validateRentalWindow } from "@/lib/domain/schedule";
import { CATALOG_PAGE_SIZE, type CatalogQuery } from "@/lib/validation/catalog-query";
import { db } from "../db";
import { getAvailability } from "./availability";
import { getSettings } from "./settings";

/** Hanya alat publik, aktif, dan belum dihapus yang terlihat pelanggan (Req 2.1, 3.5). */
export const PUBLIC_ITEM: Prisma.ItemWhereInput = { deletedAt: null, isActive: true, visibility: "PUBLIC" };

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  pricePerDay: number;
  depositPerUnit: number;
  allowKtp: boolean;
  image: string | null;
}

export interface CatalogItemDetail extends CatalogItem {
  description: string | null;
  specs: Record<string, string> | null;
  images: string[];
  stock: number;
}

export const listInclude = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
} satisfies Prisma.ItemInclude;

export function toCatalogItem(row: Prisma.ItemGetPayload<{ include: typeof listInclude }>): CatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    pricePerDay: row.pricePerDay,
    depositPerUnit: row.depositPerUnit,
    allowKtp: row.allowKtp,
    image: row.images[0]?.url ?? null,
  };
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Katalog dengan pencarian, filter, urutan, dan filter ketersediaan tanggal (Req 2.2–2.4). */
export async function listCatalog(query: CatalogQuery, now = new Date()): Promise<CatalogPage> {
  const orderBy: Prisma.ItemOrderByWithRelationInput[] =
    query.sort === "termurah"
      ? [{ pricePerDay: "asc" }, { name: "asc" }]
      : query.sort === "termahal"
        ? [{ pricePerDay: "desc" }, { name: "asc" }]
        : [{ name: "asc" }];

  let rows = await db.item.findMany({
    where: {
      ...PUBLIC_ITEM,
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? { pricePerDay: { gte: query.minPrice, lte: query.maxPrice } }
        : {}),
    },
    include: listInclude,
    orderBy,
  });

  // Satu toko: jumlah alat kecil, jadi ketersediaan dihitung untuk semua hasil lalu dipaginasi.
  if (query.window) {
    const availability = await getAvailability(
      rows.map((r) => r.id),
      query.window,
      { now },
    );
    rows = rows.filter((r) => (availability.get(r.id)?.available ?? 0) >= 1);
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  return {
    items: rows.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE).map(toCatalogItem),
    total,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    totalPages,
  };
}

/** Alat unggulan beranda: yang paling sering disewa, lalu yang terbaru. */
export async function listFeaturedItems(limit = 8): Promise<CatalogItem[]> {
  const rows = await db.item.findMany({
    where: PUBLIC_ITEM,
    include: listInclude,
    orderBy: [{ orderItems: { _count: "desc" } }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toCatalogItem);
}

/** Kategori yang punya alat publik, dengan jumlahnya. */
export async function listCatalogCategories() {
  const rows = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: { where: PUBLIC_ITEM } } } },
  });
  return rows
    .filter((c) => c._count.items > 0)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, itemCount: c._count.items }));
}

export async function getCatalogItem(slug: string): Promise<CatalogItemDetail> {
  const row = await db.item.findFirst({
    where: { ...PUBLIC_ITEM, slug },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { order: "asc" }, select: { url: true } },
    },
  });
  // Alat internal/nonaktif sengaja dijawab sama dengan "tidak ada" (Req 3.5)
  if (!row) throw new DomainError("TIDAK_DITEMUKAN", "Alat tidak ditemukan.");
  return {
    ...toCatalogItem({ ...row, images: row.images.slice(0, 1) }),
    description: row.description,
    specs: (row.specs as Record<string, string> | null) ?? null,
    images: row.images.map((i) => i.url),
    stock: row.stock,
  };
}

/**
 * Unit tersedia untuk satu alat publik (Req 3.3). Waktu divalidasi dengan aturan yang sama
 * seperti saat checkout, sehingga pelanggan tahu lebih awal jika waktunya tidak bisa dipakai.
 */
export async function getCatalogAvailability(slug: string, window: { start: Date; end: Date }, now = new Date()) {
  const item = await getCatalogItem(slug);
  const settings = await getSettings();
  validateRentalWindow({ startAt: window.start, endAt: window.end, now, source: "ONLINE", hours: settings });
  const availability = (await getAvailability([item.id], window, { now })).get(item.id)!;
  return {
    itemId: item.id,
    available: availability.available,
    stock: availability.stock,
    rentalDays: rentalDays(window.start, window.end),
  };
}

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { bookingsOverCapacity, effectiveEnd, peakUsage } from "@/lib/domain/availability";
import { DomainError } from "@/lib/domain/errors";
import type { OrderStatus, Visibility } from "@/lib/domain/types";
import { slugify } from "@/lib/slug";
import type { AdminItemListQuery, ItemCreateInput, ItemUpdateInput, QuickItemInput } from "@/lib/validation/catalog";
import { db } from "../db";
import { holdingOrderWhere } from "./availability";

export interface AdminItem {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  specs: Record<string, string> | null;
  pricePerDay: number;
  depositPerUnit: number;
  stock: number;
  visibility: Visibility;
  allowKtp: boolean;
  isActive: boolean;
  images: string[];
  updatedAt: Date;
}

const adminInclude = {
  category: { select: { name: true } },
  images: { orderBy: { order: "asc" }, select: { url: true } },
} satisfies Prisma.ItemInclude;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof adminInclude }>;

function toAdminItem(row: ItemRow): AdminItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    description: row.description,
    specs: (row.specs as Record<string, string> | null) ?? null,
    pricePerDay: row.pricePerDay,
    depositPerUnit: row.depositPerUnit,
    stock: row.stock,
    visibility: row.visibility,
    allowKtp: row.allowKtp,
    isActive: row.isActive,
    images: row.images.map((i) => i.url),
    updatedAt: row.updatedAt,
  };
}

// ---------- Baca ----------

export async function listAdminItems(query: AdminItemListQuery): Promise<AdminItem[]> {
  const statusFilter: Prisma.ItemWhereInput =
    query.status === "publik"
      ? { visibility: "PUBLIC", isActive: true }
      : query.status === "internal"
        ? { visibility: "INTERNAL", isActive: true }
        : query.status === "nonaktif"
          ? { isActive: false }
          : {};

  const rows = await db.item.findMany({
    where: {
      deletedAt: null,
      ...statusFilter,
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      ...(query.kategori ? { categoryId: query.kategori } : {}),
    },
    include: adminInclude,
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map(toAdminItem);
}

export async function getAdminItem(id: string): Promise<AdminItem> {
  const row = await db.item.findFirst({ where: { id, deletedAt: null }, include: adminInclude });
  if (!row) throw new DomainError("TIDAK_DITEMUKAN", "Alat tidak ditemukan.");
  return toAdminItem(row);
}

// ---------- Pesanan yang menahan stok (untuk peringatan stok & hapus alat) ----------

export interface AffectedOrder {
  orderId: string;
  code: string;
  customerName: string;
  status: OrderStatus;
  startAt: Date;
  endAt: Date;
  quantity: number;
}

/** Pesanan yang masih/akan memakai alat ini dari sekarang ke depan (Req 5.2, 5.3). */
async function upcomingBookings(itemId: string, now: Date) {
  const rows = await db.orderItem.findMany({
    where: {
      itemId,
      order: holdingOrderWhere(now),
    },
    select: {
      quantity: true,
      order: { select: { id: true, code: true, customerName: true, status: true, startAt: true, endAt: true } },
    },
  });

  return rows
    .map((r) => {
      const end = effectiveEnd(r.order.status, r.order.endAt, now);
      return {
        // Pemakaian yang sudah lewat tidak relevan; mulai dihitung dari sekarang
        start: r.order.startAt.getTime() < now.getTime() ? now : r.order.startAt,
        end,
        quantity: r.quantity,
        info: {
          orderId: r.order.id,
          code: r.order.code,
          customerName: r.order.customerName,
          status: r.order.status,
          startAt: r.order.startAt,
          endAt: r.order.endAt,
          quantity: r.quantity,
        } satisfies AffectedOrder,
      };
    })
    .filter((b) => b.end.getTime() > now.getTime());
}

/** Dampak jika stok alat diubah menjadi `newStock` (Req 12.3). */
export async function stockImpact(itemId: string, newStock: number, now = new Date()) {
  const bookings = await upcomingBookings(itemId, now);
  return {
    peak: peakUsage(bookings),
    affected: bookingsOverCapacity(bookings, newStock).map((b) => b.info),
  };
}

// ---------- Tulis ----------

async function assertCategoryExists(categoryId: string) {
  const exists = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!exists) {
    throw new DomainError("VALIDASI_GAGAL", "Kategori tidak ditemukan.", [
      { path: "categoryId", message: "Kategori tidak ditemukan" },
    ]);
  }
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const clash = await db.item.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) {
    throw new DomainError("KONFLIK", "Slug sudah dipakai alat lain.", [{ path: "slug", message: "Slug sudah dipakai" }]);
  }
}

/** "tenda-dome" → "tenda-dome", lalu "tenda-dome-2", "tenda-dome-3", ... jika sudah dipakai. */
async function uniqueSlugFrom(name: string): Promise<string> {
  const base = slugify(name) || "alat";
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await db.item.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new DomainError("KONFLIK", "Tidak bisa membuat slug unik.");
}

const jsonOrDbNull = (value: Record<string, string> | null) => value ?? Prisma.DbNull;

export async function createItem(input: ItemCreateInput): Promise<AdminItem> {
  await assertCategoryExists(input.categoryId);
  let slug: string;
  if (input.slug) {
    await assertSlugFree(input.slug);
    slug = input.slug;
  } else {
    slug = await uniqueSlugFrom(input.name);
  }

  const row = await db.item.create({
    data: {
      name: input.name,
      slug,
      categoryId: input.categoryId,
      description: input.description ?? null,
      specs: input.specs === undefined ? undefined : jsonOrDbNull(input.specs),
      pricePerDay: input.pricePerDay,
      depositPerUnit: input.depositPerUnit,
      stock: input.stock,
      visibility: input.visibility,
      allowKtp: input.allowKtp,
      isActive: input.isActive,
      images: { create: input.images.map((url, order) => ({ url, order })) },
    },
    include: adminInclude,
  });
  return toAdminItem(row);
}

export async function updateItem(
  id: string,
  input: ItemUpdateInput,
  options: { confirmStockReduction?: boolean } = {},
): Promise<AdminItem> {
  const existing = await getAdminItem(id);
  if (input.categoryId && input.categoryId !== existing.categoryId) await assertCategoryExists(input.categoryId);
  if (input.slug && input.slug !== existing.slug) await assertSlugFree(input.slug, id);

  if (input.stock !== undefined && input.stock < existing.stock && !options.confirmStockReduction) {
    const impact = await stockImpact(id, input.stock);
    if (impact.affected.length > 0) {
      throw new DomainError(
        "STOK_DI_BAWAH_PESANAN",
        `Stok ${input.stock} lebih kecil dari ${impact.peak} unit yang sudah dipesan pada waktu yang sama.`,
        impact,
      );
    }
  }

  const { images, specs, ...fields } = input;
  const row = await db.$transaction(async (tx) => {
    if (images) {
      await tx.itemImage.deleteMany({ where: { itemId: id } });
      await tx.itemImage.createMany({ data: images.map((url, order) => ({ itemId: id, url, order })) });
    }
    return tx.item.update({
      where: { id },
      data: { ...fields, ...(specs === undefined ? {} : { specs: jsonOrDbNull(specs) }) },
      include: adminInclude,
    });
  });
  return toAdminItem(row);
}

/**
 * Soft delete (Req 12.1): data tetap ada untuk riwayat pesanan, tapi hilang dari daftar dan katalog.
 * Ditolak jika alat masih dipakai pesanan yang berjalan atau akan datang.
 */
/**
 * "Tambah alat cepat" dari form sewa walk-in (Req 13.4). Selalu dibuat sebagai INTERNAL,
 * dipaksa di server terlepas dari apa pun yang dikirim klien.
 */
export async function createQuickItem(input: QuickItemInput): Promise<AdminItem> {
  return createItem({
    name: input.name,
    categoryId: input.categoryId,
    description: null,
    specs: null,
    pricePerDay: input.pricePerDay,
    depositPerUnit: input.depositPerUnit,
    stock: input.stock,
    visibility: "INTERNAL",
    allowKtp: input.allowKtp,
    isActive: true,
    images: [],
  });
}

export async function deleteItem(id: string): Promise<void> {
  await getAdminItem(id);
  const bookings = await upcomingBookings(id, new Date());
  if (bookings.length > 0) {
    throw new DomainError(
      "KONFLIK",
      `Alat masih dipakai ${bookings.length} pesanan yang berjalan atau akan datang. Nonaktifkan saja, lalu hapus setelah pesanan selesai.`,
      { affected: bookings.map((b) => b.info) },
    );
  }
  await db.item.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

import "server-only";
import { DomainError } from "@/lib/domain/errors";
import { slugify } from "@/lib/slug";
import type { CategoryInput } from "@/lib/validation/catalog";
import { db } from "../db";

export interface CategoryWithCount {
  id: string;
  name: string;
  slug: string;
  /** Jumlah alat yang belum dihapus (publik + internal) */
  itemCount: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export async function listCategories(): Promise<CategoryWithCount[]> {
  const rows = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: { where: { deletedAt: null } } } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, itemCount: c._count.items }));
}

export async function listPublicCategories(): Promise<PublicCategory[]> {
  return db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

async function assertUnique(name: string, slug: string, exceptId?: string) {
  const clash = await db.category.findFirst({
    where: {
      id: exceptId ? { not: exceptId } : undefined,
      OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }],
    },
    select: { name: true, slug: true },
  });
  if (!clash) return;
  const field = clash.name.toLowerCase() === name.toLowerCase() ? "name" : "slug";
  throw new DomainError(
    "KONFLIK",
    field === "name" ? "Nama kategori sudah dipakai." : "Slug kategori sudah dipakai.",
    [{ path: field, message: field === "name" ? "Nama kategori sudah dipakai" : "Slug sudah dipakai" }],
  );
}

function resolveSlug(input: CategoryInput): string {
  const slug = input.slug ?? slugify(input.name);
  if (slug.length < 2) {
    throw new DomainError("VALIDASI_GAGAL", "Nama kategori tidak bisa dijadikan slug.", [
      { path: "name", message: "Gunakan huruf atau angka" },
    ]);
  }
  return slug;
}

export async function createCategory(input: CategoryInput): Promise<CategoryWithCount> {
  const slug = resolveSlug(input);
  await assertUnique(input.name, slug);
  const row = await db.category.create({ data: { name: input.name, slug } });
  return { ...row, itemCount: 0 };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<CategoryWithCount> {
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new DomainError("TIDAK_DITEMUKAN", "Kategori tidak ditemukan.");
  // Slug tidak berubah otomatis saat nama diganti, supaya URL katalog lama tetap berlaku.
  const slug = input.slug ?? existing.slug;
  await assertUnique(input.name, slug, id);
  await db.category.update({ where: { id }, data: { name: input.name, slug } });
  return (await listCategories()).find((c) => c.id === id)!;
}

/** Kategori hanya bisa dihapus jika tidak pernah dipakai alat mana pun (termasuk yang sudah dihapus). */
export async function deleteCategory(id: string): Promise<void> {
  const category = await db.category.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
  if (!category) throw new DomainError("TIDAK_DITEMUKAN", "Kategori tidak ditemukan.");
  if (category._count.items > 0) {
    throw new DomainError(
      "KONFLIK",
      `Kategori "${category.name}" masih dipakai oleh ${category._count.items} alat. Pindahkan alatnya ke kategori lain dulu.`,
    );
  }
  await db.category.delete({ where: { id } });
}

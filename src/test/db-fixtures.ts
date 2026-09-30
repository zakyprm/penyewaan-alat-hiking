/** Helper data untuk integration test. Hanya dipakai dengan database test. */
import { db } from "@/server/db";

/** Kosongkan semua tabel bisnis (tanpa menyentuh tabel migrasi Prisma). */
export async function resetDatabase() {
  await db.$executeRawUnsafe(`
    TRUNCATE "OrderEvent", "OrderCharge", "Payment", "Guarantee", "OrderItem", "Order",
      "OrderCodeCounter", "ItemImage", "Item", "Category", "Setting",
      "Session", "Account", "Verification", "User"
    RESTART IDENTITY CASCADE`);
  await db.setting.create({ data: { id: 1 } });
}

let counter = 0;

export async function createCategory(name = `Kategori ${++counter}`) {
  return db.category.create({ data: { name, slug: `kategori-${counter}-${Date.now()}` } });
}

export async function createItem(
  overrides: Partial<{
    name: string;
    stock: number;
    pricePerDay: number;
    depositPerUnit: number;
    visibility: "PUBLIC" | "INTERNAL";
    allowKtp: boolean;
    isActive: boolean;
  }> = {},
) {
  const category = await createCategory();
  const n = ++counter;
  return db.item.create({
    data: {
      name: overrides.name ?? `Alat ${n}`,
      slug: `alat-${n}-${Date.now()}`,
      categoryId: category.id,
      pricePerDay: overrides.pricePerDay ?? 50_000,
      depositPerUnit: overrides.depositPerUnit ?? 100_000,
      stock: overrides.stock ?? 1,
      visibility: overrides.visibility ?? "PUBLIC",
      allowKtp: overrides.allowKtp ?? true,
      isActive: overrides.isActive ?? true,
    },
  });
}

/** Waktu WIB: wib("2030-01-12T10:00") */
export const wib = (local: string) => new Date(`${local}:00+07:00`);

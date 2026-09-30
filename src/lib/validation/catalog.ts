import { z } from "zod";
import { VISIBILITIES } from "../domain/types";
import { isAllowedExternalImage } from "../image-hosts";
import { rupiahSchema, slugSchema } from "./common";

// ---------- Kategori (Req 12.5) ----------

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(50, "Nama kategori maksimal 50 karakter"),
  /** Opsional: jika kosong, dibuat dari nama */
  slug: slugSchema.optional(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

// ---------- Alat (Req 12.2) ----------

const LOCAL_UPLOAD = /^\/uploads\/items\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * URL foto: hasil upload kita sendiri (server/storage.ts), atau https dari host yang
 * diizinkan di src/lib/image-hosts.ts. URL dari situs lain sembarang ditolak.
 */
export const imageUrlSchema = z
  .string()
  .max(500)
  .refine((v) => LOCAL_UPLOAD.test(v) || isAllowedExternalImage(v), { error: "URL foto tidak valid" });

export const MAX_ITEM_IMAGES = 8;

export const itemSpecsSchema = z
  .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(100))
  .refine((specs) => Object.keys(specs).length <= 20, { error: "Maksimal 20 spesifikasi" });

// Tanpa nilai default, supaya bisa dipakai ulang untuk update parsial.
const itemFields = {
  name: z.string().trim().min(3, "Nama alat minimal 3 karakter").max(100, "Nama alat maksimal 100 karakter"),
  slug: slugSchema,
  categoryId: z.string().trim().min(1, "Pilih kategori").max(64),
  description: z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter"),
  specs: itemSpecsSchema,
  pricePerDay: rupiahSchema.min(1_000, "Harga sewa minimal Rp 1.000"),
  depositPerUnit: rupiahSchema,
  stock: z.int("Stok harus bilangan bulat").min(0, "Stok tidak boleh negatif").max(1_000, "Stok maksimal 1.000"),
  visibility: z.enum(VISIBILITIES),
  allowKtp: z.boolean(),
  isActive: z.boolean(),
  /** Urutan = urutan tampil; foto pertama jadi foto utama */
  images: z.array(imageUrlSchema).max(MAX_ITEM_IMAGES, `Maksimal ${MAX_ITEM_IMAGES} foto`),
};

export const itemCreateSchema = z.object({
  ...itemFields,
  slug: itemFields.slug.optional(),
  description: itemFields.description.nullable().optional(),
  specs: itemFields.specs.nullable().optional(),
  depositPerUnit: itemFields.depositPerUnit.default(0),
  visibility: itemFields.visibility.default("PUBLIC"),
  allowKtp: itemFields.allowKtp.default(true),
  isActive: itemFields.isActive.default(true),
  images: itemFields.images.default([]),
});
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;

/** PATCH: hanya field yang dikirim yang diubah; tidak ada default yang ikut terisi. */
export const itemUpdateSchema = z
  .object({
    ...itemFields,
    description: itemFields.description.nullable(),
    specs: itemFields.specs.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { error: "Tidak ada perubahan yang dikirim" });
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;

/** "Tambah alat cepat" dari form walk-in; selalu disimpan sebagai INTERNAL (Req 13.4). */
export const quickItemSchema = z.object({
  name: itemFields.name,
  categoryId: itemFields.categoryId,
  pricePerDay: itemFields.pricePerDay,
  depositPerUnit: itemFields.depositPerUnit.default(0),
  stock: itemFields.stock.min(1, "Stok minimal 1"),
  allowKtp: itemFields.allowKtp.default(true),
});
export type QuickItemInput = z.infer<typeof quickItemSchema>;

// ---------- Form admin (spesifikasi sebagai baris yang bisa ditambah/hapus) ----------

export const itemFormSchema = z.object({
  name: itemFields.name,
  categoryId: itemFields.categoryId,
  description: itemFields.description,
  specs: z
    .array(z.object({ key: z.string().trim().max(40), value: z.string().trim().max(100) }))
    .max(20, "Maksimal 20 spesifikasi")
    .refine((rows) => rows.every((r) => (r.key === "") === (r.value === "")), {
      error: "Lengkapi nama dan isi setiap spesifikasi",
    })
    .refine(
      (rows) => {
        const keys = rows.filter((r) => r.key).map((r) => r.key.toLowerCase());
        return new Set(keys).size === keys.length;
      },
      { error: "Nama spesifikasi tidak boleh sama" },
    ),
  pricePerDay: itemFields.pricePerDay,
  depositPerUnit: itemFields.depositPerUnit,
  stock: itemFields.stock,
  visibility: itemFields.visibility,
  allowKtp: itemFields.allowKtp,
  isActive: itemFields.isActive,
  images: itemFields.images,
});
export type ItemFormValues = z.infer<typeof itemFormSchema>;

/** Ubah nilai form menjadi body API (dipakai untuk POST maupun PATCH). */
export function itemFormToPayload(values: ItemFormValues) {
  const specs = Object.fromEntries(values.specs.filter((r) => r.key && r.value).map((r) => [r.key, r.value]));
  return {
    ...values,
    description: values.description || null,
    specs: Object.keys(specs).length > 0 ? specs : null,
  };
}

// ---------- Query daftar alat admin ----------

export const ADMIN_ITEM_FILTERS = ["semua", "publik", "internal", "nonaktif"] as const;
export type AdminItemFilter = (typeof ADMIN_ITEM_FILTERS)[number];

/** Query yang tidak valid jatuh ke nilai default, supaya URL yang diketik manual tidak membuat error. */
export const adminItemListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(ADMIN_ITEM_FILTERS).catch("semua"),
  kategori: z.string().trim().max(64).optional().catch(undefined),
});
export type AdminItemListQuery = z.infer<typeof adminItemListQuerySchema>;

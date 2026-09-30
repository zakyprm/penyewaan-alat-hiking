import { z } from "zod";

export const idSchema = z.string().trim().min(1, "ID wajib diisi").max(64);

export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug minimal 2 karakter")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung");

/** Nominal Rupiah bilangan bulat (Req 6.6). */
export const rupiahSchema = z
  .int("Nominal harus bilangan bulat")
  .min(0, "Nominal tidak boleh negatif")
  .max(100_000_000, "Nominal terlalu besar");

export const personNameSchema = z.string().trim().min(2, "Nama minimal 2 karakter").max(100);

/** "+62 812-3456-7890" / "6281234567890" / "081234567890" → "081234567890" */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s-]/g, "");
  if (digits.startsWith("+62")) return `0${digits.slice(3)}`;
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  return digits;
}

/** Nomor HP Indonesia, disimpan dalam format 08xxxxxxxxxx. */
export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^08\d{7,12}$/, "Nomor HP tidak valid, contoh: 081234567890"));

/**
 * Waktu dari klien: ISO 8601 dengan zona waktu, misal "2026-09-27T10:00:00+07:00".
 * Dikonversi ke Date (UTC) untuk disimpan (Req 18.7).
 */
export const dateTimeSchema = z
  .iso.datetime({ offset: true, error: "Format waktu tidak valid" })
  .transform((value) => new Date(value));

export const noteSchema = z.string().trim().max(500, "Catatan maksimal 500 karakter");

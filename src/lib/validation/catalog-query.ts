import { z } from "zod";
import { parseDateTimeParam } from "../datetime-local";

/** Nilai kosong dari form GET ("") dianggap tidak diisi. */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalPrice = z
  .preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100_000_000).optional())
  .catch(undefined);

const optionalDateTime = z
  .preprocess(emptyToUndefined, z.string().optional())
  .transform((v) => (v ? (parseDateTimeParam(v) ?? undefined) : undefined))
  .catch(undefined);

export const CATALOG_SORTS = ["nama", "termurah", "termahal"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_PAGE_SIZE = 12;

/**
 * Query katalog (Req 2.2–2.4). Nilai tidak valid diabaikan (bukan error), supaya URL
 * yang diketik manual atau dibagikan tetap menampilkan katalog.
 */
export const catalogQuerySchema = z
  .object({
    q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()).catch(undefined),
    category: z
      .preprocess(emptyToUndefined, z.string().regex(/^[a-z0-9-]{1,80}$/).optional())
      .catch(undefined),
    minPrice: optionalPrice,
    maxPrice: optionalPrice,
    start: optionalDateTime,
    end: optionalDateTime,
    sort: z.enum(CATALOG_SORTS).catch("nama"),
    page: z.coerce.number().int().min(1).max(1000).catch(1),
  })
  .transform((v) => ({
    ...v,
    /** Filter ketersediaan hanya berlaku jika kedua waktu diisi dan urutannya benar */
    window: v.start && v.end && v.end.getTime() > v.start.getTime() ? { start: v.start, end: v.end } : undefined,
  }));
export type CatalogQuery = z.output<typeof catalogQuerySchema>;

const requiredDateTime = z
  .string("Waktu wajib diisi")
  .transform((v, ctx) => {
    const date = parseDateTimeParam(v);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Format waktu tidak valid, contoh: 2030-01-12T10:00" });
      return z.NEVER;
    }
    return date;
  });

/** GET /items/:slug/availability?start&end */
export const availabilityQuerySchema = z.object({ start: requiredDateTime, end: requiredDateTime });

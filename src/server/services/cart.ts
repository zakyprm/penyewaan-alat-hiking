import "server-only";
import { isDomainError, type DomainErrorCode } from "@/lib/domain/errors";
import { guaranteeOptions, type GuaranteeOption } from "@/lib/domain/guarantee";
import { quote, rentalDays } from "@/lib/domain/pricing";
import { validateRentalWindow } from "@/lib/domain/schedule";
import { db } from "../db";
import { getAvailability } from "./availability";
import { listInclude, PUBLIC_ITEM, toCatalogItem, type CatalogItem } from "./catalog";
import { getSettings } from "./settings";

/**
 * - TERSEDIA: cukup untuk jumlah yang diminta
 * - STOK_KURANG: ada, tapi unit tersedia < jumlah (Req 4.2)
 * - TIDAK_TERSEDIA: alat sudah tidak dijual (dihapus, nonaktif, atau jadi internal)
 * - BELUM_DICEK: waktu sewa belum valid, jadi stok belum bisa dihitung
 */
export type QuoteLineStatus = "TERSEDIA" | "STOK_KURANG" | "TIDAK_TERSEDIA" | "BELUM_DICEK";

export interface QuoteLine {
  itemId: string;
  quantity: number;
  status: QuoteLineStatus;
  /** Unit tersedia pada waktu sewa; null jika belum dicek atau alat tidak tersedia */
  available: number | null;
  /** Data alat terkini dari server; null jika alat tidak tersedia lagi */
  item: CatalogItem | null;
  lineTotal: number;
  /** Deposit baris ini jika memilih jaminan deposit */
  lineDeposit: number;
}

export interface CartQuote {
  days: number;
  /** Masalah waktu sewa (jam operasional, terlalu dekat) — ditampilkan, bukan error */
  windowIssue: { code: DomainErrorCode; message: string } | null;
  lines: QuoteLine[];
  rentalSubtotal: number;
  /** Total deposit jika memilih jaminan deposit */
  depositTotal: number;
  guaranteeOptions: GuaranteeOption[];
  /** Semua alat tersedia, waktu valid, dan minimal satu jaminan bisa dipakai */
  canCheckout: boolean;
}

const WINDOW_CODES: DomainErrorCode[] = ["WAKTU_TIDAK_VALID", "DI_LUAR_JAM_OPERASIONAL"];

/**
 * Rincian biaya dan ketersediaan keranjang (Req 4.2, 4.3, 7.3).
 * Harga selalu dari database, bukan dari keranjang di perangkat pelanggan.
 */
export async function quoteCart(
  input: { items: { itemId: string; quantity: number }[]; startAt: Date; endAt: Date },
  now = new Date(),
): Promise<CartQuote> {
  const settings = await getSettings();

  let windowIssue: CartQuote["windowIssue"] = null;
  try {
    validateRentalWindow({ startAt: input.startAt, endAt: input.endAt, now, source: "ONLINE", hours: settings });
  } catch (error) {
    if (!isDomainError(error) || !WINDOW_CODES.includes(error.code)) throw error;
    windowIssue = { code: error.code, message: error.message };
  }
  const days = rentalDays(input.startAt, input.endAt);

  const quantities = new Map<string, number>();
  for (const l of input.items) quantities.set(l.itemId, (quantities.get(l.itemId) ?? 0) + l.quantity);
  const ids = [...quantities.keys()];

  const rows = await db.item.findMany({ where: { ...PUBLIC_ITEM, id: { in: ids } }, include: listInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const availability = windowIssue
    ? null
    : await getAvailability(
        rows.map((r) => r.id),
        { start: input.startAt, end: input.endAt },
        { now },
      );

  const found = ids.filter((id) => byId.has(id));
  const priced = found.length
    ? quote(
        found.map((id) => ({ itemId: id, ...byId.get(id)!, quantity: quantities.get(id)! })),
        days,
        "DEPOSIT",
      )
    : null;
  const pricedById = new Map(priced?.lines.map((l) => [l.itemId, l]));

  const lines: QuoteLine[] = ids.map((id) => {
    const quantity = quantities.get(id)!;
    const row = byId.get(id);
    if (!row) return { itemId: id, quantity, status: "TIDAK_TERSEDIA", available: null, item: null, lineTotal: 0, lineDeposit: 0 };
    const available = availability?.get(id)?.available ?? null;
    const status: QuoteLineStatus = available === null ? "BELUM_DICEK" : available >= quantity ? "TERSEDIA" : "STOK_KURANG";
    const p = pricedById.get(id)!;
    return { itemId: id, quantity, status, available, item: toCatalogItem(row), lineTotal: p.lineTotal, lineDeposit: p.lineDeposit };
  });

  const options = guaranteeOptions(rows, settings);
  return {
    days,
    windowIssue,
    lines,
    rentalSubtotal: priced?.rentalSubtotal ?? 0,
    depositTotal: priced?.depositTotal ?? 0,
    guaranteeOptions: options,
    canCheckout:
      !windowIssue && lines.length > 0 && lines.every((l) => l.status === "TERSEDIA") && options.some((o) => o.available),
  };
}

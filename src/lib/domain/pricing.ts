import { assertInt, DomainError } from "./errors";
import type { GuaranteeType } from "./types";

export const HOUR_MS = 3_600_000;

/**
 * Jumlah hari sewa (Req 6.1): selisih jam dibagi 24, dibulatkan ke atas, minimal 1.
 * Contoh: 24 jam = 1 hari, 25 jam = 2 hari, 3 jam = 1 hari.
 */
export function rentalDays(startAt: Date, endAt: Date): number {
  const hours = (endAt.getTime() - startAt.getTime()) / HOUR_MS;
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new DomainError("WAKTU_TIDAK_VALID", "Waktu kembali harus setelah waktu ambil.");
  }
  return Math.max(1, Math.ceil(hours / 24));
}

export interface PriceLine {
  pricePerDay: number;
  depositPerUnit: number;
  quantity: number;
}

export type PricedLine<T extends PriceLine> = T & {
  /** harga per hari × jumlah hari × jumlah unit (Req 6.2) */
  lineTotal: number;
  /** deposit per unit × jumlah unit, 0 jika jaminan KTP */
  lineDeposit: number;
};

export interface Quote<T extends PriceLine> {
  days: number;
  lines: PricedLine<T>[];
  rentalSubtotal: number;
  depositTotal: number;
  /** Total dibayar di awal = sewa + deposit (Req 6.4) */
  totalDue: number;
}

/** Hitung rincian biaya pesanan (Req 6.2–6.4). Semua nominal Rupiah bilangan bulat. */
export function quote<T extends PriceLine>(
  lines: readonly T[],
  days: number,
  guarantee: GuaranteeType,
): Quote<T> {
  assertInt(days, "days", 1);
  if (lines.length === 0) {
    throw new DomainError("VALIDASI_GAGAL", "Pesanan harus berisi minimal satu alat.");
  }

  const priced = lines.map((line) => {
    assertInt(line.pricePerDay, "pricePerDay");
    assertInt(line.depositPerUnit, "depositPerUnit");
    assertInt(line.quantity, "quantity", 1);
    return {
      ...line,
      lineTotal: line.pricePerDay * days * line.quantity,
      lineDeposit: guarantee === "DEPOSIT" ? line.depositPerUnit * line.quantity : 0,
    };
  });

  const rentalSubtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  const depositTotal = priced.reduce((sum, l) => sum + l.lineDeposit, 0);

  return { days, lines: priced, rentalSubtotal, depositTotal, totalDue: rentalSubtotal + depositTotal };
}

import { assertInt } from "./errors";
import { HOUR_MS } from "./pricing";

export interface LateFineInput {
  /** Jatuh tempo asli */
  endAt: Date;
  returnedAt: Date;
  /** Snapshot dari pesanan (Req 10.5) */
  graceHours: number;
  lateFinePercent: number;
  lines: readonly { pricePerDay: number; quantity: number }[];
}

export interface LateFineResult {
  /** Jam telat dihitung dari jatuh tempo asli, 0 jika tidak telat */
  lateHours: number;
  /** 0 jika masih dalam grace period */
  lateDays: number;
  amount: number;
}

/** Batas akhir grace period = jatuh tempo + graceHours. */
export function graceEndsAt(endAt: Date, graceHours: number): Date {
  return new Date(endAt.getTime() + graceHours * HOUR_MS);
}

/**
 * Denda keterlambatan (Req 10.2–10.4).
 * - Kembali <= jatuh tempo + grace: denda 0 (batas inklusif).
 * - Lewat grace: jam telat dihitung dari jatuh tempo asli, hari telat = ceil(jam / 24).
 * - Denda = Σ(harga per hari × unit) × hari telat × persen / 100, dibulatkan ke Rupiah terdekat.
 */
export function lateFine(input: LateFineInput): LateFineResult {
  assertInt(input.graceHours, "graceHours");
  assertInt(input.lateFinePercent, "lateFinePercent");

  const lateHours = Math.max(0, (input.returnedAt.getTime() - input.endAt.getTime()) / HOUR_MS);
  if (lateHours <= input.graceHours) {
    return { lateHours, lateDays: 0, amount: 0 };
  }

  const lateDays = Math.ceil(lateHours / 24);
  const perDay = input.lines.reduce((sum, l) => sum + l.pricePerDay * l.quantity, 0);
  const amount = Math.round((perDay * lateDays * input.lateFinePercent) / 100);
  return { lateHours, lateDays, amount };
}

export type ReturnTimeliness = "BELUM_JATUH_TEMPO" | "DALAM_GRACE" | "TERLAMBAT";

/** Status keterlambatan alat yang sedang disewa, untuk badge di daftar pesanan (Req 14.5). */
export function returnTimeliness(endAt: Date, graceHours: number, now: Date): ReturnTimeliness {
  if (now.getTime() <= endAt.getTime()) return "BELUM_JATUH_TEMPO";
  if (now.getTime() <= graceEndsAt(endAt, graceHours).getTime()) return "DALAM_GRACE";
  return "TERLAMBAT";
}

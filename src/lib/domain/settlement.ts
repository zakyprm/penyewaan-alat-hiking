import { assertInt } from "./errors";
import type { GuaranteeType } from "./types";

export interface SettlementResult {
  /** Sisa deposit yang dikembalikan ke pelanggan */
  refund: number;
  /** Denda yang harus ditagih langsung ke pelanggan */
  amountToCollect: number;
  /** Bagian denda yang ditutup dari deposit */
  coveredByDeposit: number;
}

/**
 * Penyelesaian jaminan setelah alat kembali (Req 11.4, 11.5).
 * - Deposit: denda dipotong dari deposit; sisanya dikembalikan, kekurangannya ditagih.
 * - KTP: seluruh denda dibayar langsung sebelum KTP dikembalikan.
 */
export function settle(guarantee: GuaranteeType, depositTotal: number, totalCharges: number): SettlementResult {
  assertInt(depositTotal, "depositTotal");
  assertInt(totalCharges, "totalCharges");

  if (guarantee === "KTP") {
    return { refund: 0, amountToCollect: totalCharges, coveredByDeposit: 0 };
  }

  const coveredByDeposit = Math.min(depositTotal, totalCharges);
  return {
    refund: depositTotal - coveredByDeposit,
    amountToCollect: totalCharges - coveredByDeposit,
    coveredByDeposit,
  };
}

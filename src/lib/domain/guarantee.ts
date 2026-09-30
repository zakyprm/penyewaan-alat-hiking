import { DomainError } from "./errors";
import type { GuaranteeType } from "./types";

export interface GuaranteeItem {
  name: string;
  allowKtp: boolean;
}

export interface GuaranteeSettings {
  depositEnabled: boolean;
  ktpEnabled: boolean;
}

export interface GuaranteeOption {
  type: GuaranteeType;
  available: boolean;
  /** Alasan jika tidak tersedia, untuk ditampilkan ke pelanggan */
  reason?: string;
  /** Nama alat yang membuat KTP tidak bisa dipakai (Req 7.3) */
  blockingItems: string[];
}

/**
 * Jaminan yang bisa dipilih untuk sebuah pesanan (Req 7.2, 7.3).
 * Jaminan yang dinonaktifkan admin tetap dikembalikan dengan `available: false`,
 * dan UI memutuskan apakah menyembunyikannya.
 */
export function guaranteeOptions(
  items: readonly GuaranteeItem[],
  settings: GuaranteeSettings,
): GuaranteeOption[] {
  const deposit: GuaranteeOption = settings.depositEnabled
    ? { type: "DEPOSIT", available: true, blockingItems: [] }
    : { type: "DEPOSIT", available: false, reason: "Jaminan deposit sedang tidak tersedia.", blockingItems: [] };

  let ktp: GuaranteeOption;
  if (!settings.ktpEnabled) {
    ktp = { type: "KTP", available: false, reason: "Jaminan KTP sedang tidak tersedia.", blockingItems: [] };
  } else {
    const blockingItems = items.filter((i) => !i.allowKtp).map((i) => i.name);
    ktp =
      blockingItems.length > 0
        ? {
            type: "KTP",
            available: false,
            reason: `Jaminan KTP tidak berlaku untuk: ${blockingItems.join(", ")}.`,
            blockingItems,
          }
        : { type: "KTP", available: true, blockingItems: [] };
  }

  return [deposit, ktp];
}

/** Lempar error jika jaminan yang dipilih tidak diizinkan. Dipakai saat pesanan dibuat. */
export function assertGuaranteeAllowed(
  type: GuaranteeType,
  items: readonly GuaranteeItem[],
  settings: GuaranteeSettings,
): void {
  const option = guaranteeOptions(items, settings).find((o) => o.type === type)!;
  if (!option.available) {
    throw new DomainError("JAMINAN_TIDAK_DIIZINKAN", option.reason ?? "Jaminan tidak diizinkan.", {
      type,
      blockingItems: option.blockingItems,
    });
  }
}

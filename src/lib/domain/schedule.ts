import { TZDate } from "@date-fns/tz";
import { assertInt, DomainError } from "./errors";
import { HOUR_MS } from "./pricing";
import type { OrderSource, PaymentMethod } from "./types";

/** Zona waktu bisnis toko (Req 18.7). */
export const BUSINESS_TIME_ZONE = "Asia/Jakarta";

/** Pesanan online paling cepat 1 jam sebelum waktu ambil. */
export const MIN_ONLINE_LEAD_MINUTES = 60;

/** Walk-in boleh dicatat sedikit mundur (alat sudah dibawa sebelum admin selesai input). */
export const WALK_IN_BACKDATE_TOLERANCE_MINUTES = 15;

const MINUTE_MS = 60_000;

export interface OperatingHours {
  /** Jam buka WIB, 0–23 */
  openHour: number;
  /** Jam tutup WIB, 1–24 */
  closeHour: number;
}

/** Menit sejak tengah malam dalam WIB. */
export function minutesOfDayInBusinessTz(date: Date): number {
  const local = new TZDate(date.getTime(), BUSINESS_TIME_ZONE);
  return local.getHours() * 60 + local.getMinutes();
}

/** Waktu berada di dalam jam operasional, batas buka dan tutup inklusif (Req 17.3). */
export function isWithinOperatingHours(date: Date, hours: OperatingHours): boolean {
  const minutes = minutesOfDayInBusinessTz(date);
  return minutes >= hours.openHour * 60 && minutes <= hours.closeHour * 60;
}

export interface RentalWindowInput {
  startAt: Date;
  endAt: Date;
  now: Date;
  source: OrderSource;
  hours: OperatingHours;
}

/**
 * Validasi waktu ambil dan waktu kembali (design 5.7).
 * Melempar DomainError dengan kode WAKTU_TIDAK_VALID atau DI_LUAR_JAM_OPERASIONAL.
 */
export function validateRentalWindow({ startAt, endAt, now, source, hours }: RentalWindowInput): void {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new DomainError("WAKTU_TIDAK_VALID", "Waktu sewa tidak valid.");
  }
  if (endAt.getTime() <= startAt.getTime()) {
    throw new DomainError("WAKTU_TIDAK_VALID", "Waktu kembali harus setelah waktu ambil.", { field: "endAt" });
  }

  if (source === "ONLINE") {
    const earliest = now.getTime() + MIN_ONLINE_LEAD_MINUTES * MINUTE_MS;
    if (startAt.getTime() < earliest) {
      throw new DomainError(
        "WAKTU_TIDAK_VALID",
        `Waktu ambil paling cepat ${MIN_ONLINE_LEAD_MINUTES} menit dari sekarang.`,
        { field: "startAt" },
      );
    }
  } else {
    const earliest = now.getTime() - WALK_IN_BACKDATE_TOLERANCE_MINUTES * MINUTE_MS;
    if (startAt.getTime() < earliest) {
      throw new DomainError("WAKTU_TIDAK_VALID", "Waktu ambil tidak boleh di masa lalu.", { field: "startAt" });
    }
  }

  const range = `${String(hours.openHour).padStart(2, "0")}.00–${String(hours.closeHour).padStart(2, "0")}.00 WIB`;
  if (!isWithinOperatingHours(startAt, hours)) {
    throw new DomainError("DI_LUAR_JAM_OPERASIONAL", `Waktu ambil harus di jam operasional (${range}).`, {
      field: "startAt",
    });
  }
  if (!isWithinOperatingHours(endAt, hours)) {
    throw new DomainError("DI_LUAR_JAM_OPERASIONAL", `Waktu kembali harus di jam operasional (${range}).`, {
      field: "endAt",
    });
  }
}

export interface PaymentDueInput {
  source: OrderSource;
  method: PaymentMethod;
  createdAt: Date;
  startAt: Date;
  onlinePaymentExpiryMin: number;
  payAtStoreCancelHours: number;
}

/**
 * Batas waktu pembayaran (Req 8.5, 8.7; design 5.7).
 * - Walk-in: null (admin yang mengelola pembayaran di tempat).
 * - Online: dibuat + N menit, tapi tidak melewati waktu ambil.
 * - Bayar di toko: waktu ambil − N jam; jika itu sudah lewat saat pesanan dibuat, pakai waktu ambil.
 */
export function computePaymentDueAt(input: PaymentDueInput): Date | null {
  if (input.source === "WALK_IN") return null;

  if (input.method === "ONLINE") {
    assertInt(input.onlinePaymentExpiryMin, "onlinePaymentExpiryMin", 1);
    const due = input.createdAt.getTime() + input.onlinePaymentExpiryMin * MINUTE_MS;
    return new Date(Math.min(due, input.startAt.getTime()));
  }

  assertInt(input.payAtStoreCancelHours, "payAtStoreCancelHours");
  const due = input.startAt.getTime() - input.payAtStoreCancelHours * HOUR_MS;
  return new Date(due <= input.createdAt.getTime() ? input.startAt.getTime() : due);
}

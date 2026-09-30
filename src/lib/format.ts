import { format } from "date-fns";
import { id } from "date-fns/locale";
import { tz } from "@date-fns/tz";
import { BUSINESS_TIME_ZONE } from "./domain/schedule";

export { BUSINESS_TIME_ZONE };

const wib = tz(BUSINESS_TIME_ZONE);

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 50000 -> "Rp 50.000" (Rupiah bilangan bulat, Req 6.6). */
export function formatRupiah(amount: number): string {
  // Intl memakai spasi tak terputus; diganti spasi biasa agar konsisten di UI dan tes.
  return rupiahFormatter.format(amount).replace(/\u00a0/g, " ");
}

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "Minggu, 27 Sep 2026" dalam WIB. */
export function formatDate(value: DateInput): string {
  return format(toDate(value), "EEEE, d MMM yyyy", { in: wib, locale: id });
}

/** "Minggu, 27 Sep 2026 10.00 WIB". */
export function formatDateTime(value: DateInput): string {
  return `${format(toDate(value), "EEEE, d MMM yyyy HH.mm", { in: wib, locale: id })} WIB`;
}

/** "10.00" dalam WIB. */
export function formatTime(value: DateInput): string {
  return format(toDate(value), "HH.mm", { in: wib, locale: id });
}

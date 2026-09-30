import { TZDate } from "@date-fns/tz";
import { BUSINESS_TIME_ZONE } from "./domain/schedule";

/**
 * Format waktu untuk <input type="datetime-local"> dan parameter URL: "2030-01-12T10:00".
 * Selalu dibaca sebagai WIB, apa pun zona waktu perangkat pelanggan.
 */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DDTHH:mm" (WIB) */
export function toWibLocal(date: Date): string {
  const d = new TZDate(date.getTime(), BUSINESS_TIME_ZONE);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (WIB) → Date. Tanggal yang tidak ada (misal 30 Februari) → null. */
export function parseWibLocal(value: string): Date | null {
  if (!LOCAL.test(value)) return null;
  const date = new Date(`${value}:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return toWibLocal(date) === value ? date : null;
}

/** Parameter waktu dari URL/API: format lokal WIB atau ISO lengkap dengan zona waktu. */
export function parseDateTimeParam(value: string): Date | null {
  const local = parseWibLocal(value);
  if (local) return local;
  if (!ISO_WITH_OFFSET.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

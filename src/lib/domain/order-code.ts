import { TZDate } from "@date-fns/tz";
import { BUSINESS_TIME_ZONE } from "./schedule";

/** Hari bisnis (WIB) dalam format YYMMDD, dipakai sebagai kunci penghitung kode pesanan. */
export function orderCodeDay(date: Date): string {
  const d = new TZDate(date.getTime(), BUSINESS_TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** HK-260926-0001. Lebih dari 9999 pesanan sehari tetap unik (digit bertambah). */
export function formatOrderCode(day: string, sequence: number): string {
  return `HK-${day}-${String(sequence).padStart(4, "0")}`;
}

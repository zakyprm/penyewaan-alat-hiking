import type { OrderStatus } from "./types";

/** Satu pemakaian unit alat dalam rentang [start, end). */
export interface Booking {
  start: Date;
  end: Date;
  quantity: number;
}

/** Dua rentang setengah-terbuka beririsan jika a.start < b.end && b.start < a.end (design 5.4). */
export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** Tanggal terjauh yang bisa diwakili Date; dipakai sebagai "tanpa batas akhir". */
export const OPEN_ENDED = new Date(8.64e15);

/**
 * Akhir rentang efektif (Req 5.3): alat DIAMBIL yang sudah melewati jatuh tempo (termasuk
 * masih dalam grace period) belum ada di toko, jadi dianggap terpakai tanpa batas akhir
 * sampai admin mencatat pengembaliannya. Tidak ada yang bisa memesan unit itu sebelum kembali.
 */
export function effectiveEnd(status: OrderStatus, endAt: Date, now: Date): Date {
  return status === "DIAMBIL" && endAt.getTime() <= now.getTime() ? OPEN_ENDED : endAt;
}

/** Jumlah unit terpakai di setiap titik perubahan, diurutkan menurut waktu. */
export function usageTimeline(bookings: readonly Booking[]): { at: number; usage: number }[] {
  const deltas = new Map<number, number>();
  for (const b of bookings) {
    if (b.end.getTime() <= b.start.getTime() || b.quantity <= 0) continue;
    deltas.set(b.start.getTime(), (deltas.get(b.start.getTime()) ?? 0) + b.quantity);
    deltas.set(b.end.getTime(), (deltas.get(b.end.getTime()) ?? 0) - b.quantity);
  }
  let usage = 0;
  return [...deltas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, delta]) => {
      usage += delta; // selesai dan mulai di waktu yang sama saling meniadakan (rentang setengah-terbuka)
      return { at, usage };
    });
}

/** Unit terbanyak yang terpakai bersamaan. */
export function peakUsage(bookings: readonly Booking[]): number {
  return usageTimeline(bookings).reduce((max, p) => Math.max(max, p.usage), 0);
}

/**
 * Booking yang terdampak jika kapasitas turun: booking yang rentangnya melewati
 * saat pemakaian melebihi kapasitas.
 */
export function bookingsOverCapacity<T extends Booking>(bookings: readonly T[], capacity: number): T[] {
  const timeline = usageTimeline(bookings);
  const overloaded = timeline
    .map((point, i) => ({ start: point.at, end: timeline[i + 1]?.at ?? Infinity, usage: point.usage }))
    .filter((segment) => segment.usage > capacity);

  return bookings.filter((b) =>
    overloaded.some((s) => b.start.getTime() < s.end && s.start < b.end.getTime()),
  );
}

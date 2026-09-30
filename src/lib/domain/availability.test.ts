import { describe, expect, it } from "vitest";
import { bookingsOverCapacity, effectiveEnd, OPEN_ENDED, overlaps, peakUsage } from "./availability";

const d = (day: number, hour = 10) => new Date(Date.UTC(2026, 9, day, hour));
const booking = (id: string, start: number, end: number, quantity: number) => ({
  id,
  start: d(start),
  end: d(end),
  quantity,
});

describe("overlaps", () => {
  it("rentang yang bersambung tidak beririsan (setengah-terbuka)", () => {
    expect(overlaps({ start: d(1), end: d(3) }, { start: d(3), end: d(5) })).toBe(false);
    expect(overlaps({ start: d(1), end: d(4) }, { start: d(3), end: d(5) })).toBe(true);
    expect(overlaps({ start: d(2), end: d(3) }, { start: d(1), end: d(5) })).toBe(true);
  });
});

describe("effectiveEnd (Req 5.3)", () => {
  const now = d(10);
  it("DIAMBIL yang lewat jatuh tempo terpakai tanpa batas akhir sampai dikembalikan", () => {
    expect(effectiveEnd("DIAMBIL", d(8), now)).toEqual(OPEN_ENDED);
    expect(effectiveEnd("DIAMBIL", now, now)).toEqual(OPEN_ENDED);
  });
  it("status lain atau belum jatuh tempo tidak berubah", () => {
    expect(effectiveEnd("DIAMBIL", d(12), now)).toEqual(d(12));
    expect(effectiveEnd("DIKONFIRMASI", d(8), now)).toEqual(d(8));
  });
});

describe("peakUsage", () => {
  it("menjumlah hanya yang benar-benar bersamaan", () => {
    // A: 1-3 (2 unit), B: 3-5 (2 unit) → tidak bersamaan; C: 2-4 (1 unit) bersamaan dengan keduanya
    const bookings = [booking("A", 1, 3, 2), booking("B", 3, 5, 2), booking("C", 2, 4, 1)];
    expect(peakUsage(bookings)).toBe(3);
  });

  it("kosong = 0", () => {
    expect(peakUsage([])).toBe(0);
  });
});

describe("bookingsOverCapacity (Req 12.3)", () => {
  const bookings = [booking("A", 1, 3, 2), booking("B", 3, 5, 2), booking("C", 2, 4, 1), booking("D", 7, 8, 1)];

  it("mengembalikan booking yang melewati masa kelebihan", () => {
    // Stok 2: kelebihan di hari 2-4 (A+C, lalu B+C) → A, B, C terdampak; D aman
    expect(bookingsOverCapacity(bookings, 2).map((b) => b.id)).toEqual(["A", "B", "C"]);
  });

  it("stok cukup → tidak ada yang terdampak", () => {
    expect(bookingsOverCapacity(bookings, 3)).toEqual([]);
  });
});

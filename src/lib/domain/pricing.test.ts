import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { quote, rentalDays } from "./pricing";

const at = (iso: string) => new Date(iso);

describe("rentalDays (Req 6.1)", () => {
  it.each([
    ["2026-09-25T10:00:00+07:00", "2026-09-26T10:00:00+07:00", 1], // tepat 24 jam
    ["2026-09-25T10:00:00+07:00", "2026-09-25T13:00:00+07:00", 1], // < 24 jam tetap 1 hari
    ["2026-09-25T10:00:00+07:00", "2026-09-26T11:00:00+07:00", 2], // 25 jam
    ["2026-09-25T10:00:00+07:00", "2026-09-28T10:00:00+07:00", 3], // Jumat-Senin
  ])("%s → %s = %i hari", (start, end, days) => {
    expect(rentalDays(at(start), at(end))).toBe(days);
  });

  it("menolak waktu kembali yang tidak setelah waktu ambil", () => {
    const t = at("2026-09-25T10:00:00+07:00");
    expect(() => rentalDays(t, t)).toThrow(DomainError);
    expect(() => rentalDays(t, at("2026-09-25T09:00:00+07:00"))).toThrow(/setelah waktu ambil/);
  });
});

describe("quote (Req 6.2–6.4)", () => {
  const lines = [
    { itemId: "tenda", pricePerDay: 50_000, depositPerUnit: 100_000, quantity: 1 },
    { itemId: "carrier", pricePerDay: 25_000, depositPerUnit: 75_000, quantity: 2 },
  ];

  it("menghitung sewa dan deposit untuk jaminan DEPOSIT", () => {
    const q = quote(lines, 3, "DEPOSIT");
    expect(q.lines.map((l) => l.lineTotal)).toEqual([150_000, 150_000]);
    expect(q.lines.map((l) => l.lineDeposit)).toEqual([100_000, 150_000]);
    expect(q.rentalSubtotal).toBe(300_000);
    expect(q.depositTotal).toBe(250_000);
    expect(q.totalDue).toBe(550_000);
    expect(q.lines[0].itemId).toBe("tenda"); // properti tambahan tetap terbawa
  });

  it("deposit 0 untuk jaminan KTP", () => {
    const q = quote(lines, 3, "KTP");
    expect(q.depositTotal).toBe(0);
    expect(q.totalDue).toBe(300_000);
  });

  it("contoh diskusi: 1 tenda Rp50.000 × 3 hari + deposit Rp100.000 = Rp250.000", () => {
    const q = quote([{ pricePerDay: 50_000, depositPerUnit: 100_000, quantity: 1 }], 3, "DEPOSIT");
    expect(q.totalDue).toBe(250_000);
  });

  it("menolak input tidak valid", () => {
    expect(() => quote([], 1, "DEPOSIT")).toThrow(DomainError);
    expect(() => quote(lines, 0, "DEPOSIT")).toThrow(DomainError);
    expect(() => quote([{ ...lines[0], quantity: 0 }], 1, "DEPOSIT")).toThrow(DomainError);
    expect(() => quote([{ ...lines[0], pricePerDay: 1.5 }], 1, "DEPOSIT")).toThrow(DomainError);
  });
});

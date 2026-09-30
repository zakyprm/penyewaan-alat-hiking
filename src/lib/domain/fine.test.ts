import { describe, expect, it } from "vitest";
import { graceEndsAt, lateFine, returnTimeliness } from "./fine";

// Jatuh tempo Minggu 27 Sep 2026 10.00 WIB, 1 tenda Rp50.000/hari (Req 10.6, design 5.2)
const endAt = new Date("2026-09-27T10:00:00+07:00");
const base = { endAt, graceHours: 12, lateFinePercent: 100, lines: [{ pricePerDay: 50_000, quantity: 1 }] };

describe("lateFine", () => {
  it.each([
    ["Minggu 09.00 (lebih awal)", "2026-09-27T09:00:00+07:00", 0, 0],
    ["Minggu 20.00 (dalam grace)", "2026-09-27T20:00:00+07:00", 0, 0],
    ["Minggu 22.00 (tepat batas grace, inklusif)", "2026-09-27T22:00:00+07:00", 0, 0],
    ["Minggu 22.01 (lewat grace)", "2026-09-27T22:01:00+07:00", 1, 50_000],
    ["Senin 09.00 (telat 23 jam)", "2026-09-28T09:00:00+07:00", 1, 50_000],
    ["Senin 10.00 (telat 24 jam)", "2026-09-28T10:00:00+07:00", 1, 50_000],
    ["Senin 12.00 (telat 26 jam)", "2026-09-28T12:00:00+07:00", 2, 100_000],
    ["Rabu 09.00 (telat 71 jam)", "2026-09-30T09:00:00+07:00", 3, 150_000],
  ])("%s", (_label, returned, lateDays, amount) => {
    const r = lateFine({ ...base, returnedAt: new Date(returned) });
    expect(r.lateDays).toBe(lateDays);
    expect(r.amount).toBe(amount);
  });

  it("jam telat dihitung dari jatuh tempo asli, bukan dari akhir grace", () => {
    const r = lateFine({ ...base, returnedAt: new Date("2026-09-28T12:00:00+07:00") });
    expect(r.lateHours).toBe(26);
  });

  it("menjumlahkan semua alat dan unit", () => {
    const r = lateFine({
      ...base,
      lines: [
        { pricePerDay: 50_000, quantity: 1 },
        { pricePerDay: 25_000, quantity: 2 },
      ],
      returnedAt: new Date("2026-09-28T09:00:00+07:00"),
    });
    expect(r.amount).toBe(100_000);
  });

  it("memakai persentase denda dan membulatkan ke Rupiah", () => {
    const r = lateFine({
      ...base,
      lateFinePercent: 150,
      lines: [{ pricePerDay: 7_001, quantity: 1 }],
      returnedAt: new Date("2026-09-28T09:00:00+07:00"),
    });
    expect(r.amount).toBe(10_502); // 10.501,5 dibulatkan
  });

  it("grace 0 jam: telat 1 menit langsung kena 1 hari", () => {
    const r = lateFine({ ...base, graceHours: 0, returnedAt: new Date("2026-09-27T10:01:00+07:00") });
    expect(r.lateDays).toBe(1);
  });
});

describe("graceEndsAt & returnTimeliness", () => {
  it("batas grace = jatuh tempo + 12 jam", () => {
    expect(graceEndsAt(endAt, 12).toISOString()).toBe(new Date("2026-09-27T22:00:00+07:00").toISOString());
  });

  it.each([
    ["2026-09-27T10:00:00+07:00", "BELUM_JATUH_TEMPO"],
    ["2026-09-27T10:00:01+07:00", "DALAM_GRACE"],
    ["2026-09-27T22:00:00+07:00", "DALAM_GRACE"],
    ["2026-09-27T22:00:01+07:00", "TERLAMBAT"],
  ])("pada %s → %s", (now, expected) => {
    expect(returnTimeliness(endAt, 12, new Date(now))).toBe(expected);
  });
});

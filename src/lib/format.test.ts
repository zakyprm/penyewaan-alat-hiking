import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRupiah, formatTime } from "./format";

describe("formatRupiah", () => {
  it("memformat Rupiah tanpa desimal", () => {
    expect(formatRupiah(50000)).toBe("Rp 50.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
  });
});

describe("format tanggal WIB", () => {
  // 2026-09-27T03:00:00Z = Minggu 27 Sep 2026 10.00 WIB (UTC+7)
  const utc = new Date("2026-09-27T03:00:00Z");

  it("mengonversi UTC ke WIB", () => {
    expect(formatTime(utc)).toBe("10.00");
    expect(formatDate(utc)).toBe("Minggu, 27 Sep 2026");
    expect(formatDateTime(utc)).toBe("Minggu, 27 Sep 2026 10.00 WIB");
  });

  it("menangani pergantian hari UTC -> WIB", () => {
    // 20:00 UTC Sabtu = 03:00 WIB Minggu
    expect(formatDate("2026-09-26T20:00:00Z")).toBe("Minggu, 27 Sep 2026");
  });
});

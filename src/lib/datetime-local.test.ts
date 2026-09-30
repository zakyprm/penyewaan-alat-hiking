import { describe, expect, it } from "vitest";
import { parseDateTimeParam, parseWibLocal, toWibLocal } from "./datetime-local";

describe("waktu lokal WIB", () => {
  it("dua arah: Date ↔ string WIB", () => {
    const date = parseWibLocal("2030-01-12T10:00")!;
    expect(date.toISOString()).toBe("2030-01-12T03:00:00.000Z");
    expect(toWibLocal(date)).toBe("2030-01-12T10:00");
  });

  it("menolak format salah dan tanggal yang tidak ada", () => {
    expect(parseWibLocal("2030-02-30T10:00")).toBeNull();
    expect(parseWibLocal("2030-01-12 10:00")).toBeNull();
    expect(parseWibLocal("12/01/2030")).toBeNull();
    expect(parseWibLocal("2030-01-12T25:00")).toBeNull();
  });

  it("parameter API menerima format lokal dan ISO dengan zona waktu", () => {
    expect(parseDateTimeParam("2030-01-12T10:00")?.toISOString()).toBe("2030-01-12T03:00:00.000Z");
    expect(parseDateTimeParam("2030-01-12T03:00:00Z")?.toISOString()).toBe("2030-01-12T03:00:00.000Z");
    expect(parseDateTimeParam("2030-01-12T10:00:00+07:00")?.toISOString()).toBe("2030-01-12T03:00:00.000Z");
    expect(parseDateTimeParam("2030-01-12T10:00:00")).toBeNull(); // tanpa zona waktu: ambigu
    expect(parseDateTimeParam("besok")).toBeNull();
  });
});

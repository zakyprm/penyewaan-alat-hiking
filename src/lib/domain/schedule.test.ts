import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { computePaymentDueAt, isWithinOperatingHours, validateRentalWindow } from "./schedule";

const wib = (local: string) => new Date(`${local}+07:00`);
const hours = { openHour: 8, closeHour: 21 };

const expectCode = (fn: () => void, code: DomainError["code"]) => {
  try {
    fn();
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
  }
};

describe("isWithinOperatingHours (Req 17.3)", () => {
  it.each([
    ["2026-09-27T07:59:00", false],
    ["2026-09-27T08:00:00", true],
    ["2026-09-27T14:30:00", true],
    ["2026-09-27T21:00:00", true],
    ["2026-09-27T21:01:00", false],
  ])("%s WIB → %s", (local, expected) => {
    expect(isWithinOperatingHours(wib(local), hours)).toBe(expected);
  });

  it("memakai jam WIB, bukan jam UTC server", () => {
    // 02:00 UTC = 09:00 WIB → buka
    expect(isWithinOperatingHours(new Date("2026-09-27T02:00:00Z"), hours)).toBe(true);
    // 15:00 UTC = 22:00 WIB → tutup
    expect(isWithinOperatingHours(new Date("2026-09-27T15:00:00Z"), hours)).toBe(false);
  });
});

describe("validateRentalWindow", () => {
  const now = wib("2026-09-26T10:00:00");
  const valid = { startAt: wib("2026-09-27T10:00:00"), endAt: wib("2026-09-29T10:00:00"), now, hours };

  it("menerima rentang yang valid", () => {
    expect(() => validateRentalWindow({ ...valid, source: "ONLINE" })).not.toThrow();
  });

  it("menolak waktu kembali sebelum waktu ambil", () => {
    expectCode(
      () => validateRentalWindow({ ...valid, endAt: valid.startAt, source: "ONLINE" }),
      "WAKTU_TIDAK_VALID",
    );
  });

  it("online: waktu ambil minimal 1 jam dari sekarang", () => {
    const tooSoon = { ...valid, startAt: wib("2026-09-26T10:59:00"), source: "ONLINE" as const };
    expectCode(() => validateRentalWindow(tooSoon), "WAKTU_TIDAK_VALID");
    expect(() =>
      validateRentalWindow({ ...valid, startAt: wib("2026-09-26T11:00:00"), source: "ONLINE" }),
    ).not.toThrow();
  });

  it("walk-in: boleh sekarang, toleransi mundur 15 menit", () => {
    expect(() => validateRentalWindow({ ...valid, startAt: now, source: "WALK_IN" })).not.toThrow();
    expect(() =>
      validateRentalWindow({ ...valid, startAt: wib("2026-09-26T09:45:00"), source: "WALK_IN" }),
    ).not.toThrow();
    expectCode(
      () => validateRentalWindow({ ...valid, startAt: wib("2026-09-26T09:44:00"), source: "WALK_IN" }),
      "WAKTU_TIDAK_VALID",
    );
  });

  it("menolak waktu ambil atau kembali di luar jam operasional", () => {
    expectCode(
      () => validateRentalWindow({ ...valid, startAt: wib("2026-09-27T06:00:00"), source: "ONLINE" }),
      "DI_LUAR_JAM_OPERASIONAL",
    );
    expectCode(
      () => validateRentalWindow({ ...valid, endAt: wib("2026-09-29T22:00:00"), source: "ONLINE" }),
      "DI_LUAR_JAM_OPERASIONAL",
    );
  });
});

describe("computePaymentDueAt (Req 8.5, 8.7)", () => {
  const settings = { onlinePaymentExpiryMin: 60, payAtStoreCancelHours: 24 };
  const createdAt = wib("2026-09-26T10:00:00");

  it("online: dibuat + 60 menit", () => {
    const due = computePaymentDueAt({
      ...settings,
      source: "ONLINE",
      method: "ONLINE",
      createdAt,
      startAt: wib("2026-09-28T10:00:00"),
    });
    expect(due).toEqual(wib("2026-09-26T11:00:00"));
  });

  it("online: tidak melewati waktu ambil", () => {
    const startAt = wib("2026-09-26T10:30:00");
    const due = computePaymentDueAt({ ...settings, source: "ONLINE", method: "ONLINE", createdAt, startAt });
    expect(due).toEqual(startAt);
  });

  it("bayar di toko: 24 jam sebelum waktu ambil", () => {
    const due = computePaymentDueAt({
      ...settings,
      source: "ONLINE",
      method: "BAYAR_DI_TOKO",
      createdAt,
      startAt: wib("2026-09-28T10:00:00"),
    });
    expect(due).toEqual(wib("2026-09-27T10:00:00"));
  });

  it("bayar di toko: dipesan < 24 jam sebelumnya → batasnya saat waktu ambil", () => {
    const startAt = wib("2026-09-26T18:00:00");
    const due = computePaymentDueAt({ ...settings, source: "ONLINE", method: "BAYAR_DI_TOKO", createdAt, startAt });
    expect(due).toEqual(startAt);
  });

  it("walk-in: tanpa batas bayar", () => {
    expect(
      computePaymentDueAt({ ...settings, source: "WALK_IN", method: "BAYAR_DI_TOKO", createdAt, startAt: createdAt }),
    ).toBeNull();
  });
});

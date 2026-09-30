import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { settle } from "./settlement";

describe("settle — jaminan deposit (Req 11.4)", () => {
  it("tepat waktu: deposit kembali penuh", () => {
    expect(settle("DEPOSIT", 100_000, 0)).toEqual({ refund: 100_000, amountToCollect: 0, coveredByDeposit: 0 });
  });

  it("denda lebih kecil dari deposit: dipotong, sisanya dikembalikan", () => {
    expect(settle("DEPOSIT", 100_000, 50_000)).toEqual({
      refund: 50_000,
      amountToCollect: 0,
      coveredByDeposit: 50_000,
    });
  });

  it("denda sama dengan deposit: tidak ada refund dan tagihan", () => {
    expect(settle("DEPOSIT", 100_000, 100_000)).toEqual({
      refund: 0,
      amountToCollect: 0,
      coveredByDeposit: 100_000,
    });
  });

  it("denda melebihi deposit: kekurangan ditagih", () => {
    expect(settle("DEPOSIT", 100_000, 150_000)).toEqual({
      refund: 0,
      amountToCollect: 50_000,
      coveredByDeposit: 100_000,
    });
  });
});

describe("settle — jaminan KTP (Req 11.5)", () => {
  it("seluruh denda ditagih langsung", () => {
    expect(settle("KTP", 0, 75_000)).toEqual({ refund: 0, amountToCollect: 75_000, coveredByDeposit: 0 });
  });

  it("tanpa denda: tidak ada tagihan", () => {
    expect(settle("KTP", 0, 0)).toEqual({ refund: 0, amountToCollect: 0, coveredByDeposit: 0 });
  });
});

it("menolak nominal negatif atau pecahan", () => {
  expect(() => settle("DEPOSIT", -1, 0)).toThrow(DomainError);
  expect(() => settle("DEPOSIT", 100_000, 0.5)).toThrow(DomainError);
});

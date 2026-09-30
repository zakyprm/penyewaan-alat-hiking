import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { assertGuaranteeAllowed, guaranteeOptions } from "./guarantee";

const tenda = { name: "Tenda Dome 2 Orang", allowKtp: true };
const ultralight = { name: "Tenda Ultralight 1 Orang", allowKtp: false };
const allOn = { depositEnabled: true, ktpEnabled: true };

const byType = (items: typeof tenda[], settings = allOn) =>
  Object.fromEntries(guaranteeOptions(items, settings).map((o) => [o.type, o]));

describe("guaranteeOptions (Req 7.2, 7.3)", () => {
  it("keduanya tersedia jika semua alat mengizinkan KTP", () => {
    const o = byType([tenda]);
    expect(o.DEPOSIT.available).toBe(true);
    expect(o.KTP.available).toBe(true);
  });

  it("KTP tidak tersedia jika ada alat yang tidak mengizinkan, beserta nama alatnya", () => {
    const o = byType([tenda, ultralight]);
    expect(o.KTP.available).toBe(false);
    expect(o.KTP.blockingItems).toEqual(["Tenda Ultralight 1 Orang"]);
    expect(o.KTP.reason).toContain("Tenda Ultralight 1 Orang");
    expect(o.DEPOSIT.available).toBe(true);
  });

  it("mengikuti pengaturan aktif/nonaktif admin", () => {
    const o = byType([tenda], { depositEnabled: false, ktpEnabled: true });
    expect(o.DEPOSIT.available).toBe(false);
    expect(o.KTP.available).toBe(true);
    expect(byType([tenda], { depositEnabled: true, ktpEnabled: false }).KTP.available).toBe(false);
  });
});

describe("assertGuaranteeAllowed", () => {
  it("lolos untuk jaminan yang tersedia", () => {
    expect(() => assertGuaranteeAllowed("KTP", [tenda], allOn)).not.toThrow();
  });

  it("melempar JAMINAN_TIDAK_DIIZINKAN", () => {
    try {
      assertGuaranteeAllowed("KTP", [ultralight], allOn);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("JAMINAN_TIDAK_DIIZINKAN");
    }
  });
});

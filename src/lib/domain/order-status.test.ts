import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  assertTransition,
  availableTransitions,
  checkTransition,
  holdsStock,
  type TransitionContext,
} from "./order-status";

const ctx = (overrides: Partial<TransitionContext> = {}): TransitionContext => ({
  actor: "ADMIN",
  guaranteeType: "DEPOSIT",
  guaranteeStatus: "BELUM_DITERIMA",
  rentalPaid: true,
  outstandingCharges: 0,
  depositSettled: false,
  ...overrides,
});

describe("alur utama (Req 9.4)", () => {
  it("MENUNGGU_PEMBAYARAN → DIKONFIRMASI setelah lunas (sistem/webhook)", () => {
    expect(checkTransition("MENUNGGU_PEMBAYARAN", "DIKONFIRMASI", ctx({ actor: "SYSTEM" })).ok).toBe(true);
    expect(checkTransition("MENUNGGU_PEMBAYARAN", "DIKONFIRMASI", ctx({ rentalPaid: false })).ok).toBe(false);
    expect(checkTransition("MENUNGGU_PEMBAYARAN", "DIKONFIRMASI", ctx({ actor: "CUSTOMER" })).ok).toBe(false);
  });

  it("DIAMBIL → DIKEMBALIKAN hanya oleh admin", () => {
    expect(checkTransition("DIAMBIL", "DIKEMBALIKAN", ctx()).ok).toBe(true);
    expect(checkTransition("DIAMBIL", "DIKEMBALIKAN", ctx({ actor: "CUSTOMER" })).ok).toBe(false);
  });

  it("menolak loncatan status", () => {
    expect(checkTransition("DIKONFIRMASI", "SELESAI", ctx()).ok).toBe(false);
    expect(checkTransition("SELESAI", "DIAMBIL", ctx()).ok).toBe(false);
    expect(checkTransition("DIAMBIL", "DIBATALKAN", ctx()).ok).toBe(false);
  });
});

describe("serah alat → DIAMBIL (Req 7.7)", () => {
  it("butuh pembayaran lunas", () => {
    const r = checkTransition("DIKONFIRMASI", "DIAMBIL", ctx({ rentalPaid: false }));
    expect(r).toEqual({ ok: false, reason: "Pembayaran sewa belum lunas." });
  });

  it("jaminan KTP harus sudah diterima", () => {
    expect(checkTransition("DIKONFIRMASI", "DIAMBIL", ctx({ guaranteeType: "KTP" })).ok).toBe(false);
    expect(
      checkTransition("DIKONFIRMASI", "DIAMBIL", ctx({ guaranteeType: "KTP", guaranteeStatus: "DITERIMA" })).ok,
    ).toBe(true);
  });

  it("jaminan deposit cukup dengan pembayaran lunas", () => {
    expect(checkTransition("DIKONFIRMASI", "DIAMBIL", ctx()).ok).toBe(true);
  });
});

describe("penyelesaian → SELESAI (Req 11.6)", () => {
  it("deposit: butuh refund tercatat dan tanpa tunggakan denda", () => {
    expect(checkTransition("DIKEMBALIKAN", "SELESAI", ctx()).ok).toBe(false);
    expect(checkTransition("DIKEMBALIKAN", "SELESAI", ctx({ depositSettled: true, outstandingCharges: 1 })).ok).toBe(
      false,
    );
    expect(checkTransition("DIKEMBALIKAN", "SELESAI", ctx({ depositSettled: true })).ok).toBe(true);
  });

  it("KTP: butuh KTP dikembalikan dan denda lunas", () => {
    const ktp = { guaranteeType: "KTP" as const };
    expect(checkTransition("DIKEMBALIKAN", "SELESAI", ctx({ ...ktp, guaranteeStatus: "DITERIMA" })).ok).toBe(false);
    expect(
      checkTransition("DIKEMBALIKAN", "SELESAI", ctx({ ...ktp, guaranteeStatus: "DIKEMBALIKAN", outstandingCharges: 50_000 }))
        .ok,
    ).toBe(false);
    expect(checkTransition("DIKEMBALIKAN", "SELESAI", ctx({ ...ktp, guaranteeStatus: "DIKEMBALIKAN" })).ok).toBe(true);
  });
});

describe("pembatalan (Req 9.3, design 5.6)", () => {
  it("pelanggan bisa batal selama belum dibayar", () => {
    const customer = { actor: "CUSTOMER" as const, rentalPaid: false };
    expect(checkTransition("MENUNGGU_PEMBAYARAN", "DIBATALKAN", ctx(customer)).ok).toBe(true);
    expect(checkTransition("DIKONFIRMASI", "DIBATALKAN", ctx(customer)).ok).toBe(true);
  });

  it("pesanan lunas hanya bisa dibatalkan admin", () => {
    expect(checkTransition("DIKONFIRMASI", "DIBATALKAN", ctx({ actor: "CUSTOMER" })).ok).toBe(false);
    expect(checkTransition("DIKONFIRMASI", "DIBATALKAN", ctx({ actor: "SYSTEM" })).ok).toBe(false);
    expect(checkTransition("DIKONFIRMASI", "DIBATALKAN", ctx({ actor: "ADMIN" })).ok).toBe(true);
  });

  it("sistem membatalkan bayar-di-toko yang belum dibayar", () => {
    expect(checkTransition("DIKONFIRMASI", "DIBATALKAN", ctx({ actor: "SYSTEM", rentalPaid: false })).ok).toBe(true);
  });

  it("pemulihan pembayaran online yang terlambat hanya lewat sistem (design 6.1)", () => {
    expect(
      checkTransition("DIBATALKAN", "DIKONFIRMASI", ctx({ actor: "SYSTEM", latePaymentRecovery: true })).ok,
    ).toBe(true);
    expect(checkTransition("DIBATALKAN", "DIKONFIRMASI", ctx({ actor: "ADMIN", latePaymentRecovery: true })).ok).toBe(
      false,
    );
    expect(checkTransition("DIBATALKAN", "DIKONFIRMASI", ctx({ actor: "SYSTEM" })).ok).toBe(false);
  });
});

describe("assertTransition & availableTransitions", () => {
  it("melempar TRANSISI_TIDAK_VALID", () => {
    expect(() => assertTransition("SELESAI", "DIAMBIL", ctx())).toThrow(DomainError);
    try {
      assertTransition("SELESAI", "DIAMBIL", ctx());
    } catch (e) {
      expect((e as DomainError).code).toBe("TRANSISI_TIDAK_VALID");
    }
  });

  it("mengembalikan aksi yang valid saja", () => {
    expect(availableTransitions("DIKONFIRMASI", ctx())).toEqual(["DIAMBIL", "DIBATALKAN"]);
    expect(availableTransitions("DIKONFIRMASI", ctx({ guaranteeType: "KTP" }))).toEqual(["DIBATALKAN"]);
    expect(availableTransitions("SELESAI", ctx())).toEqual([]);
  });
});

describe("holdsStock (Req 5.2)", () => {
  const now = new Date("2026-09-26T10:00:00Z");
  const later = new Date("2026-09-26T11:00:00Z");
  const earlier = new Date("2026-09-26T09:00:00Z");

  it.each([
    ["DIKONFIRMASI", null, true],
    ["DIAMBIL", null, true],
    ["MENUNGGU_PEMBAYARAN", later, true],
    ["MENUNGGU_PEMBAYARAN", earlier, false],
    ["DIKEMBALIKAN", null, false],
    ["SELESAI", null, false],
    ["DIBATALKAN", null, false],
  ] as const)("%s (batas bayar %s) → %s", (status, due, expected) => {
    expect(holdsStock(status, due, now)).toBe(expected);
  });

  it("DIKONFIRMASI bayar di toko yang lewat batas bayar tidak menahan stok, kecuali sudah lunas", () => {
    expect(holdsStock("DIKONFIRMASI", earlier, now)).toBe(false);
    expect(holdsStock("DIKONFIRMASI", earlier, now, true)).toBe(true);
    expect(holdsStock("DIKONFIRMASI", later, now)).toBe(true);
  });
});

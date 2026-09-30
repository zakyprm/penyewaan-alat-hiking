import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapMidtransStatus, verifyMidtransSignature } from "./midtrans";

describe("verifyMidtransSignature (Req 8.4)", () => {
  const key = "SB-Mid-server-contoh";
  const base = { order_id: "HK-300110-0001-ABC", status_code: "200", gross_amount: "250000.00" };
  const sign = (n: typeof base, k = key) =>
    createHash("sha512").update(`${n.order_id}${n.status_code}${n.gross_amount}${k}`).digest("hex");

  it("menerima signature yang benar", () => {
    expect(verifyMidtransSignature({ ...base, signature_key: sign(base) }, key)).toBe(true);
  });

  it("menolak signature dari kunci lain atau data yang diubah", () => {
    expect(verifyMidtransSignature({ ...base, signature_key: sign(base, "kunci-lain") }, key)).toBe(false);
    expect(verifyMidtransSignature({ ...base, gross_amount: "1.00", signature_key: sign(base) }, key)).toBe(false);
    expect(verifyMidtransSignature({ ...base, signature_key: "abc" }, key)).toBe(false);
  });
});

describe("mapMidtransStatus", () => {
  it.each([
    ["settlement", undefined, "PAID"],
    ["capture", "accept", "PAID"],
    ["capture", "challenge", "PENDING"],
    ["pending", undefined, "PENDING"],
    ["expire", undefined, "EXPIRED"],
    ["deny", undefined, "FAILED"],
    ["cancel", undefined, "FAILED"],
    ["failure", undefined, "FAILED"],
    [undefined, undefined, "PENDING"],
  ])("%s / %s → %s", (status, fraud, expected) => {
    expect(mapMidtransStatus(status, fraud)).toBe(expected);
  });
});

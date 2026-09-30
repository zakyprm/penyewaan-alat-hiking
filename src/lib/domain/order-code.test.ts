import { describe, expect, it } from "vitest";
import { formatOrderCode, orderCodeDay } from "./order-code";

describe("kode pesanan", () => {
  it("memakai tanggal WIB, bukan UTC", () => {
    // 26 Sep 2026 20:00 UTC = 27 Sep 2026 03:00 WIB
    expect(orderCodeDay(new Date("2026-09-26T20:00:00Z"))).toBe("260927");
    expect(orderCodeDay(new Date("2026-09-26T16:59:59Z"))).toBe("260926");
  });

  it("format HK-YYMMDD-NNNN", () => {
    expect(formatOrderCode("260926", 1)).toBe("HK-260926-0001");
    expect(formatOrderCode("260926", 12345)).toBe("HK-260926-12345");
  });
});

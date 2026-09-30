import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each(["/checkout", "/pesanan/HK-260926-0001", "/alat?kategori=tenda"])("menerima %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["https://evil.example", "URL absolut"],
    ["//evil.example", "protocol-relative"],
    ["/\\evil.example", "backslash"],
    ["javascript:alert(1)", "skema javascript"],
    ["/masuk?next=/checkout", "halaman masuk"],
    ["/daftar", "halaman daftar"],
    ["/admin\n", "karakter kontrol"],
    [undefined, "kosong"],
  ])("menolak %s (%s)", (...[path]) => {
    expect(safeNextPath(path)).toBe("/");
  });

  it("memakai fallback yang diberikan", () => {
    expect(safeNextPath(null, "/admin")).toBe("/admin");
  });
});

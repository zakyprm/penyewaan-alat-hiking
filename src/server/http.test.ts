import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DomainError } from "@/lib/domain/errors";
import { errorResponse, ok, parseJson, parseQuery, withApi } from "./http";

const jsonRequest = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/v1/test", { method: "POST", headers: { "Content-Type": contentType }, body });

describe("ok", () => {
  it("membungkus data dan menonaktifkan cache", async () => {
    const res = ok({ a: 1 }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { a: 1 } });
  });
});

describe("errorResponse", () => {
  it.each([
    ["VALIDASI_GAGAL", 400],
    ["BELUM_LOGIN", 401],
    ["TIDAK_BERWENANG", 403],
    ["TIDAK_DITEMUKAN", 404],
    ["STOK_TIDAK_CUKUP", 409],
    ["TRANSISI_TIDAK_VALID", 409],
    ["JAMINAN_TIDAK_DIIZINKAN", 422],
  ] as const)("%s → %i", async (code, status) => {
    const res = errorResponse(new DomainError(code, "pesan", { x: 1 }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: { code, message: "pesan", details: { x: 1 } } });
  });

  it("ZodError → 400 dengan rincian per field", async () => {
    const result = z.object({ items: z.array(z.object({ qty: z.int().min(1, "Minimal 1") })) }).safeParse({
      items: [{ qty: 0 }],
    });
    const res = errorResponse(result.error);
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{ path: "items.0.qty", message: "Minimal 1" }]);
  });

  it("error tak dikenal → 500 tanpa membocorkan pesan asli", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("password database: rahasia"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("KESALAHAN_SERVER");
    expect(JSON.stringify(body)).not.toContain("rahasia");
    spy.mockRestore();
  });
});

describe("withApi", () => {
  it("meneruskan argumen dan menangkap error", async () => {
    const handler = withApi(async (_req: Request, ctx: { id: string }) => {
      if (ctx.id === "x") throw new DomainError("TIDAK_DITEMUKAN", "Tidak ada");
      return ok(ctx.id);
    });
    expect(await (await handler(new Request("http://localhost"), { id: "a" })).json()).toEqual({ data: "a" });
    expect((await handler(new Request("http://localhost"), { id: "x" })).status).toBe(404);
  });
});

describe("parseJson", () => {
  const schema = z.object({ name: z.string().min(2) });

  it("mengembalikan data tervalidasi", async () => {
    await expect(parseJson(jsonRequest('{"name":"Budi"}'), schema)).resolves.toEqual({ name: "Budi" });
  });

  it("menolak Content-Type selain JSON", async () => {
    await expect(parseJson(jsonRequest("name=Budi", "application/x-www-form-urlencoded"), schema)).rejects.toThrow(
      /Content-Type/,
    );
  });

  it("menolak JSON rusak", async () => {
    await expect(parseJson(jsonRequest("{rusak"), schema)).rejects.toThrow(/JSON yang valid/);
  });

  it("melempar ZodError untuk data tidak valid", async () => {
    await expect(parseJson(jsonRequest('{"name":"B"}'), schema)).rejects.toBeInstanceOf(z.ZodError);
  });
});

describe("parseQuery", () => {
  it("membaca query string dan mengambil nilai pertama", () => {
    const schema = z.object({ page: z.coerce.number().int().default(1), q: z.string().optional() });
    const req = new Request("http://localhost/api?page=2&q=tenda&q=lain");
    expect(parseQuery(req, schema)).toEqual({ page: 2, q: "tenda" });
  });
});

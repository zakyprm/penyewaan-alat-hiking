/**
 * Kerangka respons REST API /api/v1 (design bagian 7).
 *   Sukses: { data }
 *   Gagal:  { error: { code, message, details? } }
 *
 * File ini sengaja tanpa "server-only" dan tanpa akses database supaya mudah diuji.
 */
import { z } from "zod";
import { DomainError, type DomainErrorCode } from "@/lib/domain/errors";

export const ERROR_STATUS: Record<DomainErrorCode, number> = {
  VALIDASI_GAGAL: 400,
  WAKTU_TIDAK_VALID: 422,
  DI_LUAR_JAM_OPERASIONAL: 422,
  JAMINAN_TIDAK_DIIZINKAN: 422,
  STOK_TIDAK_CUKUP: 409,
  STOK_DI_BAWAH_PESANAN: 409,
  KONFLIK: 409,
  TRANSISI_TIDAK_VALID: 409,
  TIDAK_DITEMUKAN: 404,
  BELUM_LOGIN: 401,
  TIDAK_BERWENANG: 403,
};

export type ApiErrorCode = DomainErrorCode | "KESALAHAN_SERVER";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export interface ApiSuccessBody<T> {
  data: T;
}

// Respons API berisi data pengguna/pesanan: jangan di-cache browser atau CDN.
const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }): Response {
  return Response.json({ data } satisfies ApiSuccessBody<T>, {
    status: init?.status ?? 200,
    headers: { ...NO_STORE, ...init?.headers },
  });
}

export function fail(code: ApiErrorCode, message: string, status: number, details?: unknown): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return Response.json(body, { status, headers: NO_STORE });
}

/** Rincian error Zod per field: [{ path: "items.0.quantity", message: "Jumlah minimal 1" }] */
export function zodIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

/** Ubah error apa pun menjadi respons JSON yang konsisten. Error tak dikenal tidak membocorkan detail. */
export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return fail(error.code, error.message, ERROR_STATUS[error.code], error.details);
  }
  if (error instanceof z.ZodError) {
    return fail("VALIDASI_GAGAL", "Data yang dikirim tidak valid.", 400, zodIssues(error));
  }
  console.error("[api] kesalahan tak terduga:", error);
  return fail("KESALAHAN_SERVER", "Terjadi kesalahan pada server. Silakan coba lagi.", 500);
}

/** Bungkus route handler supaya semua error dipetakan lewat errorResponse(). */
export function withApi<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response> | Response,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Baca body JSON lalu validasi dengan skema Zod.
 * Mewajibkan Content-Type application/json: form lintas situs tidak bisa mengirim tipe ini
 * tanpa preflight CORS, sehingga menambah perlindungan CSRF untuk endpoint berbasis cookie.
 */
export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new DomainError("VALIDASI_GAGAL", "Content-Type harus application/json.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new DomainError("VALIDASI_GAGAL", "Body harus berupa JSON yang valid.");
  }
  return schema.parse(body);
}

/** Validasi query string (?a=1&b=2) dengan skema Zod. Parameter berulang diambil yang pertama. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.output<S> {
  const params = new URL(request.url).searchParams;
  const raw: Record<string, string> = {};
  for (const [key, value] of params) if (!(key in raw)) raw[key] = value;
  return schema.parse(raw);
}

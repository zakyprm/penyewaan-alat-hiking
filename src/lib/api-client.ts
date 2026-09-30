/** Klien REST /api/v1 untuk komponen browser. Melempar ApiError jika respons gagal. */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Dikirim sebagai JSON */
  json?: unknown;
  /** Body mentah, misal FormData untuk upload */
  body?: BodyInit;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? (options.json !== undefined || options.body ? "POST" : "GET"),
      headers: options.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch {
    throw new ApiError("JARINGAN", "Tidak dapat terhubung ke server. Periksa koneksi internet.", 0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.code ?? "KESALAHAN_SERVER",
      payload?.error?.message ?? "Terjadi kesalahan. Silakan coba lagi.",
      response.status,
      payload?.error?.details,
    );
  }
  return payload?.data as T;
}

/** Rincian error per field dari API (validasi atau konflik), untuk dipasang ke form. */
export function apiFieldErrors(error: unknown): { path: string; message: string }[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return error.details.filter(
    (d): d is { path: string; message: string } => typeof d?.path === "string" && typeof d?.message === "string",
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba lagi.";
}

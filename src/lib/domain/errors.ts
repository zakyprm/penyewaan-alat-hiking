/** Kode error domain. Dipetakan ke status HTTP di lapisan API (Task 5). */
export type DomainErrorCode =
  | "VALIDASI_GAGAL"
  | "WAKTU_TIDAK_VALID"
  | "DI_LUAR_JAM_OPERASIONAL"
  | "STOK_TIDAK_CUKUP"
  | "STOK_DI_BAWAH_PESANAN" // stok diturunkan di bawah unit yang sudah dipesan (Req 12.3)
  | "KONFLIK" // data bentrok: slug sudah dipakai, kategori masih berisi alat, dll.
  | "TRANSISI_TIDAK_VALID"
  | "JAMINAN_TIDAK_DIIZINKAN"
  | "TIDAK_DITEMUKAN"
  | "BELUM_LOGIN" // 401
  | "TIDAK_BERWENANG"; // 403

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** Pastikan nilai adalah bilangan bulat >= min. Dipakai untuk nominal Rupiah dan jumlah. */
export function assertInt(value: number, name: string, min = 0): void {
  if (!Number.isInteger(value) || value < min) {
    throw new DomainError("VALIDASI_GAGAL", `${name} harus bilangan bulat >= ${min}.`, { [name]: value });
  }
}

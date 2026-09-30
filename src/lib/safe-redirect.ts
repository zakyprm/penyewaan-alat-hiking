/**
 * Ambil path tujuan setelah login dari `?next=` dengan aman.
 * Hanya path relatif di situs ini yang diterima, untuk mencegah open redirect.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 500) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  // Jangan kembali ke halaman auth itu sendiri
  if (/^\/(masuk|daftar)(\/|\?|$)/.test(value)) return fallback;
  return value;
}

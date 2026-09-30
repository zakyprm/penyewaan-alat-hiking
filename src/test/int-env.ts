/**
 * Dijalankan sebelum setiap file integration test (setupFiles), sebelum modul aplikasi diimpor.
 * Mengarahkan DATABASE_URL ke database test supaya data development tidak tersentuh.
 */
import "dotenv/config";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) {
  throw new Error("DATABASE_URL_TEST wajib diisi dan nama database-nya harus berakhiran _test.");
}
process.env.DATABASE_URL = testUrl;

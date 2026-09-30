/** Sekali sebelum semua integration test: terapkan migrasi ke database test. */
import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !new URL(url).pathname.endsWith("_test")) {
    throw new Error("DATABASE_URL_TEST wajib diisi dan nama database-nya harus berakhiran _test.");
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}

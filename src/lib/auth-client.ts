"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/server/auth";

/** Klien auth untuk komponen browser. baseURL = origin halaman saat ini. */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

/** Pesan error Better Auth dalam Bahasa Indonesia. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number }): string {
  const code = error.code ?? "";
  if (code.includes("INVALID_EMAIL_OR_PASSWORD") || code.includes("INVALID_PASSWORD")) {
    return "Email atau password salah.";
  }
  if (code.includes("USER_ALREADY_EXISTS")) return "Email sudah terdaftar. Silakan masuk.";
  if (code.includes("PASSWORD_TOO_SHORT")) return "Password minimal 8 karakter.";
  if (code.includes("INVALID_EMAIL")) return "Format email tidak valid.";
  if (error.status === 429) return "Terlalu banyak percobaan. Coba lagi sebentar lagi.";
  if (error.status === 400 && error.message) return error.message; // misal validasi nomor HP dari server
  return "Terjadi kesalahan. Silakan coba lagi.";
}

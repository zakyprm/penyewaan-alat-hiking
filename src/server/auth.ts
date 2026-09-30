import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { phoneSchema } from "@/lib/validation/common";
import { db } from "./db";

export const googleAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Validasi + normalisasi nomor HP dari pendaftaran/ubah profil. */
function normalizePhoneField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = phoneSchema.safeParse(value);
  if (!parsed.success) {
    throw new APIError("BAD_REQUEST", { message: "Nomor HP tidak valid, contoh: 081234567890" });
  }
  return parsed.data;
}

export const auth = betterAuth({
  appName: "Sewa Alat Hiking",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },

  // Google aktif otomatis jika GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET diisi di .env
  socialProviders: googleAuthEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},

  user: {
    additionalFields: {
      // input: false → tidak bisa diisi lewat sign-up / update profil (Req 1.2)
      role: { type: "string", required: false, defaultValue: "CUSTOMER", input: false },
      phone: { type: "string", required: false, input: true },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            // Lapisan kedua: pendaftaran publik selalu CUSTOMER. Admin dibuat lewat seed.
            role: "CUSTOMER",
            phone: normalizePhoneField((user as { phone?: unknown }).phone) ?? null,
          },
        }),
      },
      update: {
        before: async (user) => {
          const data = { ...user } as Record<string, unknown>;
          delete data.role; // peran tidak pernah diubah lewat alur auth
          const phone = normalizePhoneField(data.phone);
          if (phone !== undefined) data.phone = phone;
          return { data };
        },
      },
    },
  },

  // bearer: sesi via header Authorization untuk mobile app (Req 1.5).
  // nextCookies harus paling akhir.
  plugins: [bearer(), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

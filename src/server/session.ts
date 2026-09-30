import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DomainError } from "@/lib/domain/errors";
import type { Role } from "@/lib/domain/types";
import { auth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
}

function toSessionUser(user: { id: string; name: string; email: string; role?: unknown; phone?: unknown }): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
    phone: typeof user.phone === "string" ? user.phone : null,
  };
}

async function userFromHeaders(requestHeaders: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session ? toSessionUser(session.user) : null;
}

// ---------- Server Components / halaman ----------

/** Pengguna yang sedang login, di-cache per request. */
export const getCurrentUser = cache(async () => userFromHeaders(await headers()));

/*
 * PENTING: layout dan page dirender paralel oleh Next.js, jadi pengecekan di layout saja
 * TIDAK mencegah isi page ikut terkirim. Setiap page yang dilindungi wajib memanggil
 * requireUserPage() / requireAdminPage() sendiri sebelum mengambil data.
 */

/** Untuk halaman pelanggan. Proxy sudah mengarahkan ke /masuk; ini lapisan pengaman kedua. */
export async function requireUserPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  return user;
}

/** Untuk halaman admin: belum login → /masuk, bukan admin → /akses-ditolak. */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk?next=/admin");
  if (user.role !== "ADMIN") redirect("/akses-ditolak");
  return user;
}

// ---------- Route Handlers (web cookie + bearer token mobile) ----------

/** 401 jika belum login. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await userFromHeaders(request.headers);
  if (!user) throw new DomainError("BELUM_LOGIN", "Silakan masuk terlebih dahulu.");
  return user;
}

/** 401 jika belum login, 403 jika bukan admin (Req 1.4). */
export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") throw new DomainError("TIDAK_BERWENANG", "Akses khusus admin.");
  return user;
}

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Pemeriksaan cepat (optimistic): hanya cek keberadaan cookie sesi, tanpa query database.
 * Validasi sesi dan peran yang sebenarnya dilakukan di layout halaman dan di setiap API.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const loginUrl = new URL("/masuk", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/checkout/:path*", "/pesanan/:path*"],
};

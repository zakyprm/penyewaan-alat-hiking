import { timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/domain/errors";
import { ok, withApi } from "@/server/http";
import { expireOrders } from "@/server/services/payments";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/v1/cron/expire-orders — dipanggil Vercel Cron (vercel.json) dengan
 * header `Authorization: Bearer <CRON_SECRET>` (design 6.4).
 */
export const GET = withApi(async (request) => {
  if (!authorized(request)) throw new DomainError("TIDAK_BERWENANG", "Akses cron ditolak.");
  return ok({ cancelled: await expireOrders() });
});

import { ok, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { completeOrder } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/:id/complete — DIKEMBALIKAN → SELESAI (Req 11.6). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/complete">) => {
  const admin = await requireAdmin(request);
  await completeOrder((await ctx.params).id, admin);
  return ok({ status: "SELESAI" });
});

import { cancelOrderSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { cancelOrderByAdmin } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/:id/cancel — { reason } (Req 14.3, 14.4). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/cancel">) => {
  const admin = await requireAdmin(request);
  const { reason } = await parseJson(request, cancelOrderSchema);
  await cancelOrderByAdmin((await ctx.params).id, admin, reason);
  return ok({ status: "DIBATALKAN" });
});

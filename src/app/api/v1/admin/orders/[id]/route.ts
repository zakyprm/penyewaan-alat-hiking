import { ok, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { getAdminOrder } from "@/server/services/admin-orders";

/** GET /api/v1/admin/orders/:id */
export const GET = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]">) => {
  await requireAdmin(request);
  return ok(await getAdminOrder((await ctx.params).id));
});

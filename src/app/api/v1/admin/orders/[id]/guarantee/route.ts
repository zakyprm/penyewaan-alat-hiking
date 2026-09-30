import { guaranteeActionSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { updateGuaranteeStatus } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/:id/guarantee — { action: "RECEIVE" | "RETURN" } (Req 7.6, 7.7). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/guarantee">) => {
  const admin = await requireAdmin(request);
  const { action } = await parseJson(request, guaranteeActionSchema);
  await updateGuaranteeStatus((await ctx.params).id, admin, action);
  return ok({ action });
});

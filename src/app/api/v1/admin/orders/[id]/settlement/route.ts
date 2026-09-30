import { ok, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { getSettlementPreview } from "@/server/services/admin-orders";

/** GET /api/v1/admin/orders/:id/settlement — pratinjau refund deposit / tagihan (Req 11.4, 11.5). */
export const GET = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/settlement">) => {
  await requireAdmin(request);
  return ok(await getSettlementPreview((await ctx.params).id));
});

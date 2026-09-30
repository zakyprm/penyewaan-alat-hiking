import { ok, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { getCustomerDetail } from "@/server/services/customers";

/** GET /api/v1/admin/customers/:id — riwayat pesanan dan total denda (Req 15.2). */
export const GET = withApi(async (request, ctx: RouteContext<"/api/v1/admin/customers/[id]">) => {
  await requireAdmin(request);
  return ok(await getCustomerDetail((await ctx.params).id));
});

import { ok, withApi } from "@/server/http";
import { requireUser } from "@/server/session";
import { getCustomerOrder } from "@/server/services/customer-orders";

/** GET /api/v1/orders/:code — detail pesanan milik pengguna yang login. */
export const GET = withApi(async (request, ctx: RouteContext<"/api/v1/orders/[code]">) => {
  const user = await requireUser(request);
  return ok(await getCustomerOrder(user.id, (await ctx.params).code));
});

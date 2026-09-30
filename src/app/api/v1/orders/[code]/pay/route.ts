import { ok, withApi } from "@/server/http";
import { requireUser } from "@/server/session";
import { payCustomerOrder } from "@/server/services/customer-orders";

/** POST /api/v1/orders/:code/pay — token Snap untuk (melanjutkan) pembayaran online. */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/orders/[code]/pay">) => {
  const user = await requireUser(request);
  return ok(await payCustomerOrder(user.id, (await ctx.params).code));
});

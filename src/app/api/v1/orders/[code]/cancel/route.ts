import { ok, withApi } from "@/server/http";
import { requireUser } from "@/server/session";
import { cancelCustomerOrder } from "@/server/services/customer-orders";

/** POST /api/v1/orders/:code/cancel — pelanggan membatalkan pesanan sendiri (Req 9.3). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/orders/[code]/cancel">) => {
  const user = await requireUser(request);
  await cancelCustomerOrder(user.id, (await ctx.params).code);
  return ok({ code: (await ctx.params).code });
});

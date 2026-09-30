import { ok, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { pickupOrder } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/:id/pickup — serah alat ke pelanggan (Req 7.7, 14.3). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/pickup">) => {
  const admin = await requireAdmin(request);
  await pickupOrder((await ctx.params).id, admin);
  return ok({ status: "DIAMBIL" });
});

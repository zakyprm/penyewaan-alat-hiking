import { returnOrderSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { returnOrder } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/:id/return — catat pengembalian alat, denda telat otomatis (Req 11.1–11.3). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/return">) => {
  const admin = await requireAdmin(request);
  const input = await parseJson(request, returnOrderSchema);
  await returnOrder((await ctx.params).id, admin, input);
  return ok({ status: "DIKEMBALIKAN" });
});

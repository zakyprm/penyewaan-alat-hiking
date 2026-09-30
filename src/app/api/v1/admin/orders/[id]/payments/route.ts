import { recordPaymentSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { recordManualPayment } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/:id/payments — catat bayar di toko, denda, atau refund deposit (Req 8.8). */
export const POST = withApi(async (request, ctx: RouteContext<"/api/v1/admin/orders/[id]/payments">) => {
  const admin = await requireAdmin(request);
  const input = await parseJson(request, recordPaymentSchema);
  const payment = await recordManualPayment((await ctx.params).id, admin, input);
  return ok(payment, { status: 201 });
});

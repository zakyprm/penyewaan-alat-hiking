import { adminOrderListQuerySchema } from "@/lib/validation/admin-order-query";
import { ok, parseQuery, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { listAdminOrders } from "@/server/services/admin-orders";

/** GET /api/v1/admin/orders?status&source&method&q&from&to (Req 14.1, 14.2). */
export const GET = withApi(async (request) => {
  await requireAdmin(request);
  return ok(await listAdminOrders(parseQuery(request, adminOrderListQuerySchema)));
});

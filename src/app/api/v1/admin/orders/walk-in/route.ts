import { walkInOrderSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { createWalkInOrder } from "@/server/services/admin-orders";

/** POST /api/v1/admin/orders/walk-in — sewa langsung di toko (Req 13). */
export const POST = withApi(async (request) => {
  const admin = await requireAdmin(request);
  const input = await parseJson(request, walkInOrderSchema);
  return ok(await createWalkInOrder(admin, input), { status: 201 });
});

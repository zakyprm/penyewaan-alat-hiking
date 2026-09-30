import { checkoutSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { requireUser } from "@/server/session";
import { listCustomerOrders, placeCustomerOrder } from "@/server/services/customer-orders";

/**
 * POST /api/v1/orders — checkout (Req 7, 8). Harga dihitung ulang di server.
 * Respons: { order, payment } — `payment` berisi token Snap jika bayar online.
 */
export const POST = withApi(async (request) => {
  const user = await requireUser(request);
  const input = await parseJson(request, checkoutSchema);
  return ok(await placeCustomerOrder(user, input), { status: 201 });
});

/** GET /api/v1/orders — daftar pesanan milik pengguna yang login (Req 9.1). */
export const GET = withApi(async (request) => {
  const user = await requireUser(request);
  return ok(await listCustomerOrders(user.id));
});

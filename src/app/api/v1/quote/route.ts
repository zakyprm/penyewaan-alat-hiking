import { quoteSchema } from "@/lib/validation/order";
import { ok, parseJson, withApi } from "@/server/http";
import { quoteCart } from "@/server/services/cart";

/**
 * POST /api/v1/quote — rincian biaya dan ketersediaan keranjang (Req 4.2, 4.3).
 * Body: { items: [{ itemId, quantity }], startAt, endAt } (ISO dengan zona waktu). Tidak perlu login.
 */
export const POST = withApi(async (request) => {
  const input = await parseJson(request, quoteSchema);
  return ok(await quoteCart(input));
});

import { ok, parseQuery, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { customerSearchQuerySchema, listCustomers } from "@/server/services/customers";

/** GET /api/v1/admin/customers?q= — daftar/cari pelanggan terdaftar (Req 15.1, 13.2). */
export const GET = withApi(async (request) => {
  await requireAdmin(request);
  const { q } = parseQuery(request, customerSearchQuerySchema);
  return ok(await listCustomers(q));
});

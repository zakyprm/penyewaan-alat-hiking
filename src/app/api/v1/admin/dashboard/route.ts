import { dashboardQuerySchema } from "@/lib/validation/dashboard-query";
import { ok, parseQuery, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { defaultPeriod, getDashboard } from "@/server/services/dashboard";

/** GET /api/v1/admin/dashboard?from&to — ringkasan toko (Req 16). Default: 30 hari terakhir. */
export const GET = withApi(async (request) => {
  await requireAdmin(request);
  const { from, to } = parseQuery(request, dashboardQuerySchema);
  const fallback = defaultPeriod();
  const period = from && to && to.getTime() > from.getTime() ? { from, to } : fallback;
  return ok(await getDashboard(period));
});

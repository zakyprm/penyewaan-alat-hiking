import { availabilityQuerySchema } from "@/lib/validation/catalog-query";
import { ok, parseQuery, withApi } from "@/server/http";
import { getCatalogAvailability } from "@/server/services/catalog";

/** GET /api/v1/items/:slug/availability?start&end — unit tersedia pada rentang waktu (Req 3.3). */
export const GET = withApi(async (request, ctx: RouteContext<"/api/v1/items/[slug]/availability">) => {
  const { start, end } = parseQuery(request, availabilityQuerySchema);
  return ok(await getCatalogAvailability((await ctx.params).slug, { start, end }));
});

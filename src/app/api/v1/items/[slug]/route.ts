import { ok, withApi } from "@/server/http";
import { getCatalogItem } from "@/server/services/catalog";

/** GET /api/v1/items/:slug — detail alat publik; alat internal → 404 (Req 3.5). */
export const GET = withApi(async (_request, ctx: RouteContext<"/api/v1/items/[slug]">) =>
  ok(await getCatalogItem((await ctx.params).slug)),
);

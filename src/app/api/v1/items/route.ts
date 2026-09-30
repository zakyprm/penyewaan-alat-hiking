import { catalogQuerySchema } from "@/lib/validation/catalog-query";
import { ok, parseQuery, withApi } from "@/server/http";
import { listCatalog } from "@/server/services/catalog";

/**
 * GET /api/v1/items?q&category=<slug>&minPrice&maxPrice&start&end&sort=nama|termurah|termahal&page
 * start/end: "2030-01-12T10:00" (WIB) atau ISO dengan zona waktu.
 */
export const GET = withApi(async (request) => ok(await listCatalog(parseQuery(request, catalogQuerySchema))));

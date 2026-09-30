import { adminItemListQuerySchema, itemCreateSchema } from "@/lib/validation/catalog";
import { ok, parseJson, parseQuery, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { createItem, listAdminItems } from "@/server/services/items";

/** GET /api/v1/admin/items?q&status=semua|publik|internal|nonaktif&kategori=<id> */
export const GET = withApi(async (request) => {
  await requireAdmin(request);
  return ok(await listAdminItems(parseQuery(request, adminItemListQuerySchema)));
});

/** POST /api/v1/admin/items */
export const POST = withApi(async (request) => {
  await requireAdmin(request);
  const input = await parseJson(request, itemCreateSchema);
  return ok(await createItem(input), { status: 201 });
});

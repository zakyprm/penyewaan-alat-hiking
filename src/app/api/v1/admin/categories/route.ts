import { categoryInputSchema } from "@/lib/validation/catalog";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { createCategory, listCategories } from "@/server/services/categories";

/** GET /api/v1/admin/categories — dengan jumlah alat per kategori. */
export const GET = withApi(async (request) => {
  await requireAdmin(request);
  return ok(await listCategories());
});

/** POST /api/v1/admin/categories */
export const POST = withApi(async (request) => {
  await requireAdmin(request);
  const input = await parseJson(request, categoryInputSchema);
  return ok(await createCategory(input), { status: 201 });
});

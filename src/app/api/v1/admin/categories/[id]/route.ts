import { categoryInputSchema } from "@/lib/validation/catalog";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { deleteCategory, updateCategory } from "@/server/services/categories";

type Ctx = RouteContext<"/api/v1/admin/categories/[id]">;

/** PATCH /api/v1/admin/categories/:id */
export const PATCH = withApi(async (request, ctx: Ctx) => {
  await requireAdmin(request);
  const { id } = await ctx.params;
  const input = await parseJson(request, categoryInputSchema);
  return ok(await updateCategory(id, input));
});

/** DELETE /api/v1/admin/categories/:id — ditolak jika masih dipakai alat. */
export const DELETE = withApi(async (request, ctx: Ctx) => {
  await requireAdmin(request);
  const { id } = await ctx.params;
  await deleteCategory(id);
  return ok({ id });
});

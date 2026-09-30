import { itemUpdateSchema } from "@/lib/validation/catalog";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { deleteItem, getAdminItem, updateItem } from "@/server/services/items";

type Ctx = RouteContext<"/api/v1/admin/items/[id]">;

/** GET /api/v1/admin/items/:id */
export const GET = withApi(async (request, ctx: Ctx) => {
  await requireAdmin(request);
  return ok(await getAdminItem((await ctx.params).id));
});

/**
 * PATCH /api/v1/admin/items/:id
 * Jika stok diturunkan di bawah unit yang sudah dipesan → 409 STOK_DI_BAWAH_PESANAN beserta
 * daftar pesanan terdampak. Kirim ulang dengan `?konfirmasiStok=1` untuk tetap menyimpan.
 */
export const PATCH = withApi(async (request, ctx: Ctx) => {
  await requireAdmin(request);
  const { id } = await ctx.params;
  const input = await parseJson(request, itemUpdateSchema);
  const confirmStockReduction = new URL(request.url).searchParams.get("konfirmasiStok") === "1";
  return ok(await updateItem(id, input, { confirmStockReduction }));
});

/** DELETE /api/v1/admin/items/:id — soft delete. */
export const DELETE = withApi(async (request, ctx: Ctx) => {
  await requireAdmin(request);
  const { id } = await ctx.params;
  await deleteItem(id);
  return ok({ id });
});

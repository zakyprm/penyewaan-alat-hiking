import { quickItemSchema } from "@/lib/validation/catalog";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { createQuickItem } from "@/server/services/items";

/** POST /api/v1/admin/items/quick — "Tambah alat cepat" dari form walk-in, selalu INTERNAL (Req 13.4). */
export const POST = withApi(async (request) => {
  await requireAdmin(request);
  const input = await parseJson(request, quickItemSchema);
  return ok(await createQuickItem(input), { status: 201 });
});

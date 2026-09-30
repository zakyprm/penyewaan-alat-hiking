import { settingsPatchSchema } from "@/lib/validation/settings";
import { ok, parseJson, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { getSettings, updateSettings } from "@/server/services/settings";

/** GET /api/v1/admin/settings */
export const GET = withApi(async (request) => {
  await requireAdmin(request);
  return ok(await getSettings());
});

/** PATCH /api/v1/admin/settings — ubah sebagian atau semua pengaturan toko (Req 17). */
export const PATCH = withApi(async (request) => {
  await requireAdmin(request);
  const changes = await parseJson(request, settingsPatchSchema);
  return ok(await updateSettings(changes));
});

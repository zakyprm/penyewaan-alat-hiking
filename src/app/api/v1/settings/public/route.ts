import { ok, withApi } from "@/server/http";
import { getSettings, toPublicSettings } from "@/server/services/settings";

/** GET /api/v1/settings/public — kebijakan toko untuk pelanggan (jam operasional, jaminan, grace, denda). */
export const GET = withApi(async () => ok(toPublicSettings(await getSettings())));

import { ok, withApi } from "@/server/http";
import { listPublicCategories } from "@/server/services/categories";

/** GET /api/v1/categories — daftar kategori untuk katalog. */
export const GET = withApi(async () => ok(await listPublicCategories()));

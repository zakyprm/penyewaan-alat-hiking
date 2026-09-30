import { DomainError } from "@/lib/domain/errors";
import { ok, withApi } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { saveItemImage } from "@/server/storage";

/** POST /api/v1/admin/uploads — multipart/form-data dengan field `file`. Mengembalikan { url }. */
export const POST = withApi(async (request) => {
  await requireAdmin(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new DomainError("VALIDASI_GAGAL", "Kirim foto sebagai multipart/form-data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new DomainError("VALIDASI_GAGAL", "Field `file` wajib berisi foto.");

  return ok({ url: await saveItemImage(file) }, { status: 201 });
});

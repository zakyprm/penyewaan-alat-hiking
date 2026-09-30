import { DomainError } from "@/lib/domain/errors";
import { ok, withApi } from "@/server/http";
import { handleMidtransNotification } from "@/server/services/payments";

/**
 * POST /api/v1/payments/midtrans/notification — webhook Midtrans (Req 8.3, 8.4).
 * Daftarkan URL ini di Dashboard Midtrans → Settings → Payment → Notification URL.
 */
export const POST = withApi(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new DomainError("VALIDASI_GAGAL", "Body harus JSON.");
  }
  return ok({ result: await handleMidtransNotification(body) });
});

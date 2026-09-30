import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Klien Midtrans Snap tanpa SDK (design 6.1).
 * Konfigurasi dibaca saat dipanggil, jadi fitur otomatis aktif begitu kunci diisi di .env.
 */
export interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  /** Host Snap (token + snap.js) */
  snapUrl: string;
  /** Host Core API (cek status) */
  apiUrl: string;
}

export function midtransConfig(): MidtransConfig | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  if (!serverKey || !clientKey) return null;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return {
    serverKey,
    clientKey,
    isProduction,
    snapUrl: isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com",
    apiUrl: isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com",
  };
}

export const isMidtransEnabled = () => midtransConfig() !== null;

function authHeader(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export interface SnapItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface SnapRequest {
  orderId: string;
  grossAmount: number;
  items: SnapItem[];
  customer: { name: string; phone: string; email?: string };
  /** Format Midtrans: "2030-01-10 10:00:00 +0700" */
  expiryStartTime: string;
  expiryMinutes: number;
  finishUrl: string;
}

export async function createSnapTransaction(req: SnapRequest): Promise<{ token: string; redirectUrl: string }> {
  const config = midtransConfig();
  if (!config) throw new Error("Midtrans belum dikonfigurasi.");
  const res = await fetch(`${config.snapUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: { Authorization: authHeader(config.serverKey), Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_details: { order_id: req.orderId, gross_amount: req.grossAmount },
      item_details: req.items.map((i) => ({ ...i, name: i.name.slice(0, 50), id: i.id.slice(0, 50) })),
      customer_details: { first_name: req.customer.name.slice(0, 50), phone: req.customer.phone, email: req.customer.email },
      expiry: { start_time: req.expiryStartTime, unit: "minute", duration: req.expiryMinutes },
      callbacks: { finish: req.finishUrl },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => null)) as { token?: string; redirect_url?: string; error_messages?: string[] } | null;
  if (!res.ok || !body?.token) {
    throw new Error(`Midtrans Snap gagal (${res.status}): ${body?.error_messages?.join("; ") ?? "tanpa pesan"}`);
  }
  return { token: body.token, redirectUrl: body.redirect_url ?? "" };
}

export interface MidtransStatus {
  status_code: string;
  order_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
}

/** Cek status langsung ke Midtrans; jangan hanya percaya isi notifikasi (design 6.1). */
export async function getTransactionStatus(orderId: string): Promise<MidtransStatus> {
  const config = midtransConfig();
  if (!config) throw new Error("Midtrans belum dikonfigurasi.");
  const res = await fetch(`${config.apiUrl}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Authorization: authHeader(config.serverKey), Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => null)) as MidtransStatus | null;
  if (!body) throw new Error(`Status Midtrans tidak terbaca (${res.status}).`);
  return body;
}

/** signature_key = SHA512(order_id + status_code + gross_amount + server_key) */
export function verifyMidtransSignature(
  n: { order_id: string; status_code: string; gross_amount: string; signature_key: string },
  serverKey: string,
): boolean {
  const expected = createHash("sha512").update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(n.signature_key.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export type PaymentOutcome = "PAID" | "PENDING" | "FAILED" | "EXPIRED";

/** Status transaksi Midtrans → hasil pembayaran kita. */
export function mapMidtransStatus(transactionStatus?: string, fraudStatus?: string): PaymentOutcome {
  switch (transactionStatus) {
    case "settlement":
      return "PAID";
    case "capture":
      return !fraudStatus || fraudStatus === "accept" ? "PAID" : "PENDING"; // challenge: tunggu review
    case "expire":
      return "EXPIRED";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    default:
      return "PENDING";
  }
}

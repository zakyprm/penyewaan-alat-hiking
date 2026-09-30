import { formatDateTime } from "@/lib/format";
import type { AdminOrderDetail } from "@/server/services/admin-orders";

const EVENT_LABEL: Record<string, string> = {
  ORDER_CREATED: "Pesanan dibuat",
  STATUS_CHANGED: "Status diubah",
  PAYMENT_STARTED: "Transaksi Midtrans dibuat",
  PAYMENT_RECORDED: "Pembayaran dicatat",
  PAYMENT_FAILED: "Pembayaran gagal/kedaluwarsa",
  PAYMENT_NEEDS_REFUND: "Perlu refund manual",
  PAYMENT_AMOUNT_MISMATCH: "Nominal notifikasi tidak sesuai",
  GUARANTEE_RECEIVED: "Jaminan KTP diterima",
  GUARANTEE_RETURNED: "Jaminan KTP dikembalikan",
  CHARGE_ADDED: "Denda ditambahkan",
};

/** Riwayat pesanan (Req 14.4). */
export function EventLog({ events }: { events: AdminOrderDetail["events"] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>;

  return (
    <ol className="grid gap-3">
      {events.map((e) => (
        <li key={e.id} className="grid gap-0.5 border-l-2 border-border pl-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
          </div>
          {e.data !== null && (
            <p className="text-xs text-muted-foreground">
              {Object.entries(e.data as Record<string, unknown>)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

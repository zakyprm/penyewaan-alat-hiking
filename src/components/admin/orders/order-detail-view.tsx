import { Ban } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { GuaranteeStatusBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/order/status-badge";
import { OrderTimeline } from "@/components/order/order-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { AdminOrderDetail } from "@/server/services/admin-orders";
import { ActionButtons } from "./action-buttons";
import { EventLog } from "./event-log";
import { PaymentForm } from "./payment-form";
import { SettlementPanel } from "./settlement-panel";

const CHANNEL_LABEL: Record<string, string> = { MIDTRANS: "Midtrans", TUNAI: "Tunai", TRANSFER: "Transfer", QRIS: "QRIS" };
const PAYMENT_STATUS_LABEL: Record<string, string> = { MENUNGGU: "Menunggu", LUNAS: "Lunas", GAGAL: "Gagal", KEDALUWARSA: "Kedaluwarsa" };

export function AdminOrderDetailView({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title={order.code}
        description={`Dibuat ${formatDateTime(order.createdAt)} · ${order.source === "ONLINE" ? "Online" : "Walk-in"}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <ActionButtons order={order} />
          </>
        }
      />

      <Card>
        <CardContent className="pt-4">
          <OrderTimeline status={order.status} paymentMethod={order.paymentMethod} />
        </CardContent>
      </Card>

      {order.status === "DIBATALKAN" && order.cancelReason && (
        <p className="flex items-center gap-2 rounded-lg bg-danger-muted px-4 py-3 text-sm text-destructive">
          <Ban className="size-4 shrink-0" aria-hidden="true" />
          Alasan: {order.cancelReason}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-muted-foreground">{order.customerPhone}</p>
              {order.customer && <p className="text-muted-foreground">Akun: {order.customer.email}</p>}
              {!order.customer && <p className="text-muted-foreground">Tamu (walk-in tanpa akun)</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alat</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ul className="divide-y">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium">{i.itemName}</p>
                      <p className="text-muted-foreground">
                        {formatRupiah(i.pricePerDay)} × {order.rentalDays} hari × {i.quantity}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatRupiah(i.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="grid gap-1 border-t pt-3 text-sm">
                <Row label="Waktu ambil" value={formatDateTime(order.startAt)} />
                <Row label="Jatuh tempo kembali" value={formatDateTime(order.endAt)} />
                <Row label="Biaya sewa" value={formatRupiah(order.rentalSubtotal)} />
                {order.depositTotal > 0 && <Row label="Deposit jaminan" value={formatRupiah(order.depositTotal)} />}
                {order.charges.map((c) => (
                  <Row key={c.id} label={c.note ?? c.type} value={formatRupiah(c.amount)} destructive />
                ))}
                <Row label="Total" value={formatRupiah(order.totalDue)} strong />
              </dl>
              {order.note && <p className="text-sm text-muted-foreground">Catatan pelanggan: {order.note}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat</CardTitle>
            </CardHeader>
            <CardContent>
              <EventLog events={order.events} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          {order.status === "DIKEMBALIKAN" && <SettlementPanel order={order} />}

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Pembayaran</CardTitle>
              <PaymentForm orderId={order.id} defaultPurpose={order.rentalPaid ? "DENDA" : "SEWA_DAN_DEPOSIT"} />
            </CardHeader>
            <CardContent className="grid gap-3">
              <PaymentStatusBadge paid={order.rentalPaid} />
              {order.outstandingCharges > 0 && (
                <p className="text-sm text-destructive">Denda belum lunas: {formatRupiah(order.outstandingCharges)}</p>
              )}
              {order.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                      <div>
                        <p>{CHANNEL_LABEL[p.channel]}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_STATUS_LABEL[p.status]} · {formatDateTime(p.createdAt)}
                        </p>
                      </div>
                      <p className="font-medium tabular-nums">{formatRupiah(p.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jaminan</CardTitle>
            </CardHeader>
            <CardContent>
              <GuaranteeStatusBadge type={order.guaranteeType} status={order.guaranteeStatus} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, destructive }: { label: string; value: string; strong?: boolean; destructive?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold tabular-nums" : destructive ? "text-destructive tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}

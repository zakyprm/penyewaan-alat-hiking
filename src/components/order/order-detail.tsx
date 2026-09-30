"use client";

import { Ban, Clock, IdCard, Loader2, Store, Wallet } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { openSnapPayment } from "@/lib/midtrans-snap";
import type { CustomerOrder } from "@/server/services/customer-orders";
import { OrderTimeline } from "./order-timeline";
import { GuaranteeStatusBadge, PaymentStatusBadge } from "./status-badge";

export function OrderDetail({ order }: { order: CustomerOrder }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function handlePay() {
    setPaying(true);
    try {
      const session = await api<{ snapToken: string; clientKey: string; snapUrl: string }>(`/orders/${order.code}/pay`);
      await openSnapPayment(session, {
        onSuccess: () => router.refresh(),
        onPending: () => router.refresh(),
        onError: () => {
          toast.error("Pembayaran gagal. Kamu bisa mencoba lagi.");
          router.refresh();
        },
        onClose: () => router.refresh(),
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.code}</h1>
          <p className="text-sm text-muted-foreground">Dibuat {formatDateTime(order.createdAt)}</p>
        </div>
        {order.canCancel && (
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            <Ban aria-hidden="true" />
            Batalkan Pesanan
          </Button>
        )}
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <OrderTimeline status={order.status} paymentMethod={order.paymentMethod} />
      </div>

      {order.status === "DIBATALKAN" && order.cancelReason && (
        <p className="rounded-lg bg-danger-muted px-4 py-3 text-sm text-destructive">Alasan: {order.cancelReason}</p>
      )}

      {order.canPayOnline && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-muted p-4">
          <p className="text-sm text-warning">
            Bayar sebelum {formatDateTime(order.paymentDueAt!)}, atau pesanan otomatis dibatalkan.
          </p>
          <Button onClick={handlePay} disabled={paying}>
            {paying && <Loader2 className="animate-spin" aria-hidden="true" />}
            Bayar Sekarang
          </Button>
        </div>
      )}
      {order.status === "MENUNGGU_PEMBAYARAN" && order.paymentMethod === "ONLINE" && !order.canPayOnline && (
        <p className="rounded-lg bg-danger-muted px-4 py-3 text-sm text-destructive">
          Batas waktu pembayaran sudah lewat. Muat ulang halaman untuk memeriksa status terbaru.
        </p>
      )}
      {order.status === "DIKONFIRMASI" && order.paymentMethod === "BAYAR_DI_TOKO" && !order.rentalPaid && order.paymentDueAt && (
        <p className="flex items-center gap-2 rounded-lg bg-info-muted px-4 py-3 text-sm text-info">
          <Store className="size-4 shrink-0" aria-hidden="true" />
          Datang dan bayar di toko sebelum {formatDateTime(order.paymentDueAt)}.
        </p>
      )}

      <section aria-labelledby="alat-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
        <h2 id="alat-heading" className="border-b px-4 py-3 font-semibold">
          Alat
        </h2>
        <ul className="divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-4">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {item.image ? (
                  <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <CategoryIcon slug="" className="absolute inset-0 m-auto size-6 text-primary/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.itemName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatRupiah(item.pricePerDay)} × {order.rentalDays} hari × {item.quantity}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatRupiah(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rincian-heading" className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 id="rincian-heading" className="font-semibold">
          Rincian
        </h2>
        <dl className="grid gap-2 text-sm">
          <Row label="Waktu ambil" value={formatDateTime(order.startAt)} />
          <Row label="Jatuh tempo kembali" value={formatDateTime(order.endAt)} />
          <Row label="Batas toleransi (grace period)" value={`${formatDateTime(order.graceEndsAt)} (${order.graceHours} jam)`} />
          <Row label="Biaya sewa" value={formatRupiah(order.rentalSubtotal)} />
          {order.depositTotal > 0 && <Row label="Deposit jaminan" value={formatRupiah(order.depositTotal)} />}
          {order.charges.map((c, i) => (
            <Row key={i} label={c.type === "TELAT" ? "Denda telat" : c.note ?? "Denda"} value={formatRupiah(c.amount)} destructive />
          ))}
          <Row label="Total" value={formatRupiah(order.totalDue)} strong />
        </dl>
      </section>

      <section aria-labelledby="jaminan-heading" className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 id="jaminan-heading" className="font-semibold">
          Jaminan &amp; pembayaran
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <GuaranteeStatusBadge type={order.guaranteeType} status={order.guaranteeStatus} />
          <PaymentStatusBadge paid={order.rentalPaid} />
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          {order.guaranteeType === "KTP" ? (
            <>
              <IdCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Bawa KTP asli saat mengambil alat. KTP dikembalikan setelah alat kembali dan denda (jika ada) lunas.
            </>
          ) : (
            <>
              <Wallet className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Deposit dikembalikan setelah alat kembali, dikurangi denda (jika ada).
            </>
          )}
        </p>
        {order.note && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Catatan: {order.note}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Batalkan pesanan?"
        description="Pesanan ini akan dibatalkan dan tidak bisa dikembalikan seperti semula."
        confirmLabel="Batalkan"
        destructive
        onConfirm={async () => {
          try {
            await api(`/orders/${order.code}/cancel`, { json: {} });
            toast.success("Pesanan dibatalkan.");
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
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

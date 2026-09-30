"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, IdCard, Loader2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { AdminOrderDetail } from "@/server/services/admin-orders";
import type { SettlementPreview } from "@/server/services/admin-orders";

/**
 * Layar penyelesaian jaminan (Req 11.4, 11.5), tampil saat pesanan DIKEMBALIKAN.
 * Deposit: catat refund sisa atau tagihan kekurangan. KTP: catat denda lunas, lalu kembalikan KTP.
 * Setelah semua syarat terpenuhi, tombol "Selesaikan Pesanan" muncul (availableActions dari server).
 */
export function SettlementPanel({ order }: { order: AdminOrderDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["settlement", order.id],
    queryFn: () => api<SettlementPreview>(`/admin/orders/${order.id}/settlement`),
  });

  async function run(key: string, action: () => Promise<unknown>) {
    setPending(key);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  const recordRefund = (amount: number) =>
    run("refund", () => api(`/admin/orders/${order.id}/payments`, { json: { purpose: "REFUND_DEPOSIT", channel: "TUNAI", amount } }));
  const recordFineCollected = (amount: number) =>
    run("denda", () => api(`/admin/orders/${order.id}/payments`, { json: { purpose: "DENDA", channel: "TUNAI", amount, note: "Ditagih saat pengembalian" } }));
  const returnKtp = () => run("ktp", () => api(`/admin/orders/${order.id}/guarantee`, { json: { action: "RETURN" } }));
  const complete = () => run("complete", () => api(`/admin/orders/${order.id}/complete`, { json: {} }));

  const refundRecorded = order.payments.some((p) => p.purpose === "REFUND_DEPOSIT" && p.status === "LUNAS");
  const canComplete = order.availableActions.includes("SELESAI");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penyelesaian</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {preview.isLoading ? (
          <Skeleton className="h-20 w-full" aria-busy="true" />
        ) : preview.isError ? (
          <p className="text-sm text-destructive">{errorMessage(preview.error)}</p>
        ) : (
          preview.data && <SettlementSummary data={preview.data} guaranteeType={order.guaranteeType} />
        )}

        {preview.data && order.guaranteeType === "DEPOSIT" && (
          <div className="grid gap-2">
            {preview.data.refund > 0 && !refundRecorded && (
              <Button variant="outline" onClick={() => recordRefund(preview.data!.refund)} disabled={pending !== null}>
                {pending === "refund" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
                Catat Pengembalian {formatRupiah(preview.data.refund)}
              </Button>
            )}
            {order.outstandingCharges > 0 && (
              <Button variant="outline" onClick={() => recordFineCollected(order.outstandingCharges)} disabled={pending !== null}>
                {pending === "denda" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
                Catat Tagihan Kekurangan Diterima {formatRupiah(order.outstandingCharges)}
              </Button>
            )}
          </div>
        )}

        {preview.data && order.guaranteeType === "KTP" && (
          <div className="grid gap-2">
            {order.outstandingCharges > 0 && (
              <Button variant="outline" onClick={() => recordFineCollected(order.outstandingCharges)} disabled={pending !== null}>
                {pending === "denda" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
                Catat Denda Diterima {formatRupiah(order.outstandingCharges)}
              </Button>
            )}
            {order.outstandingCharges === 0 && order.guaranteeStatus === "DITERIMA" && (
              <Button variant="outline" onClick={returnKtp} disabled={pending !== null}>
                {pending === "ktp" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <IdCard aria-hidden="true" />}
                Kembalikan KTP ke Pelanggan
              </Button>
            )}
          </div>
        )}

        {canComplete && (
          <Button onClick={complete} disabled={pending !== null} className="mt-1">
            {pending === "complete" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            Selesaikan Pesanan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SettlementSummary({ data, guaranteeType }: { data: SettlementPreview; guaranteeType: "DEPOSIT" | "KTP" }) {
  return (
    <dl className="grid gap-1.5 rounded-lg bg-secondary p-3 text-sm">
      {guaranteeType === "DEPOSIT" && (
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Total deposit</dt>
          <dd className="tabular-nums">{formatRupiah(data.depositTotal)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <dt className="text-muted-foreground">Total denda</dt>
        <dd className="tabular-nums">{formatRupiah(data.totalCharges)}</dd>
      </div>
      {guaranteeType === "DEPOSIT" ? (
        <>
          <div className="flex justify-between gap-2 font-medium">
            <dt>Dikembalikan ke pelanggan</dt>
            <dd className="tabular-nums">{formatRupiah(data.refund)}</dd>
          </div>
          {data.amountToCollect > 0 && (
            <div className="flex justify-between gap-2 font-medium text-destructive">
              <dt>Kekurangan yang ditagih</dt>
              <dd className="tabular-nums">{formatRupiah(data.amountToCollect)}</dd>
            </div>
          )}
        </>
      ) : (
        <div className="flex justify-between gap-2 font-medium text-destructive">
          <dt>Ditagih langsung sebelum KTP dikembalikan</dt>
          <dd className="tabular-nums">{formatRupiah(data.amountToCollect)}</dd>
        </div>
      )}
    </dl>
  );
}

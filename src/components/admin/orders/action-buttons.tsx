"use client";

import { Ban, IdCard, Loader2, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import type { OrderStatus } from "@/lib/domain/types";
import type { AdminOrderDetail } from "@/server/services/admin-orders";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { ReturnDialog } from "./return-dialog";

/** Tombol aksi status, ditampilkan sesuai `availableActions` dari server (Req 14.3). */
export function ActionButtons({ order }: { order: AdminOrderDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function run(action: () => Promise<unknown>, status: OrderStatus) {
    setPending(status);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  const buttons: React.ReactNode[] = [];

  // "Serahkan Alat" hanya dirender jika transisinya valid (lunas, dan KTP sudah diterima jika dipakai).
  // Selama syarat belum terpenuhi, admin melihat status "Lunas"/"KTP · Belum Diterima" sebagai panduan
  // di panel Pembayaran & Jaminan, bukan tombol yang nonaktif (design 5.6: tampilkan tombol yang valid saja).
  if (order.availableActions.includes("DIAMBIL")) {
    buttons.push(
      <Button key="pickup" onClick={() => run(() => api(`/admin/orders/${order.id}/pickup`, { json: {} }), "DIAMBIL")} disabled={pending !== null}>
        {pending === "DIAMBIL" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackageCheck aria-hidden="true" />}
        Serahkan Alat
      </Button>,
    );
  }

  if (order.availableActions.includes("DIKEMBALIKAN")) {
    buttons.push(<ReturnDialog key="return" order={order} />);
  }

  if (order.availableActions.includes("DIBATALKAN")) {
    buttons.push(
      <Button key="cancel" variant="outline" onClick={() => setCancelOpen(true)} disabled={pending !== null}>
        <Ban aria-hidden="true" />
        Batalkan
      </Button>,
    );
  }

  if (order.guaranteeType === "KTP" && order.guaranteeStatus === "BELUM_DITERIMA" && order.status !== "DIBATALKAN") {
    buttons.push(
      <Button
        key="receive-ktp"
        variant="outline"
        onClick={() => run(() => api(`/admin/orders/${order.id}/guarantee`, { json: { action: "RECEIVE" } }), order.status)}
        disabled={pending !== null}
      >
        {pending === order.status ? <Loader2 className="animate-spin" aria-hidden="true" /> : <IdCard aria-hidden="true" />}
        Tandai KTP Diterima
      </Button>,
    );
  }

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {buttons}
      <CancelOrderDialog orderId={order.id} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}

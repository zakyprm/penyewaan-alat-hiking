import { Ban, Check } from "lucide-react";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const LABEL: Record<OrderStatus, string> = {
  MENUNGGU_PEMBAYARAN: "Menunggu Bayar",
  DIKONFIRMASI: "Dikonfirmasi",
  DIAMBIL: "Diambil",
  DIKEMBALIKAN: "Dikembalikan",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

/** Alur normal tanpa DIBATALKAN; dipakai untuk menentukan posisi. */
const FLOW: OrderStatus[] = ["MENUNGGU_PEMBAYARAN", "DIKONFIRMASI", "DIAMBIL", "DIKEMBALIKAN", "SELESAI"];

/** Ringkasan alur status pesanan (Req 9.2). */
export function OrderTimeline({ status, paymentMethod }: { status: OrderStatus; paymentMethod: "ONLINE" | "BAYAR_DI_TOKO" }) {
  // Bayar di toko tidak pernah "menunggu pembayaran" sebagai status pesanan
  const steps = paymentMethod === "BAYAR_DI_TOKO" ? FLOW.filter((s) => s !== "MENUNGGU_PEMBAYARAN") : FLOW;

  if (status === "DIBATALKAN") {
    return (
      <ol className="flex items-center gap-2 text-sm" aria-label="Status pesanan">
        <li className="flex items-center gap-1.5 font-medium text-destructive">
          <Ban className="size-4" aria-hidden="true" />
          Dibatalkan
        </li>
      </ol>
    );
  }

  const currentIndex = steps.indexOf(status);
  return (
    <ol aria-label="Status pesanan" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 && <span className="mx-1 h-px w-4 bg-border" aria-hidden="true" />}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-xs",
                done && "bg-primary text-primary-foreground",
                current && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                !done && !current && "bg-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-3" /> : ORDER_STATUSES.indexOf(step) < 5 ? i + 1 : i + 1}
            </span>
            <span aria-current={current ? "step" : undefined} className={cn(current ? "font-medium" : "text-muted-foreground")}>
              {LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

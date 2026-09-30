import { Badge } from "@/components/ui/badge";
import type { GuaranteeStatus, GuaranteeType, OrderStatus } from "@/lib/domain/types";

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
  DIKONFIRMASI: "Dikonfirmasi",
  DIAMBIL: "Diambil",
  DIKEMBALIKAN: "Dikembalikan",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  MENUNGGU_PEMBAYARAN: "bg-warning-muted text-warning",
  DIKONFIRMASI: "bg-info-muted text-info",
  DIAMBIL: "bg-info-muted text-info",
  DIKEMBALIKAN: "bg-secondary text-secondary-foreground",
  SELESAI: "bg-success-muted text-success",
  DIBATALKAN: "bg-danger-muted text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={ORDER_STATUS_CLASS[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <Badge className="bg-success-muted text-success">Lunas</Badge>
  ) : (
    <Badge className="bg-warning-muted text-warning">Menunggu Pembayaran</Badge>
  );
}

const GUARANTEE_STATUS_LABEL: Record<GuaranteeStatus, string> = {
  BELUM_DITERIMA: "Belum Diterima",
  DITERIMA: "Diterima",
  DIKEMBALIKAN: "Dikembalikan",
};

export function GuaranteeStatusBadge({ type, status }: { type: GuaranteeType; status: GuaranteeStatus }) {
  if (type === "DEPOSIT") return <Badge className="bg-secondary text-secondary-foreground">Deposit uang</Badge>;
  const className = status === "BELUM_DITERIMA" ? "bg-warning-muted text-warning" : "bg-success-muted text-success";
  return <Badge className={className}>KTP · {GUARANTEE_STATUS_LABEL[status]}</Badge>;
}

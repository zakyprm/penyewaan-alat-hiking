import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminOrderDetailView } from "@/components/admin/orders/order-detail-view";
import { isDomainError } from "@/lib/domain/errors";
import { requireAdminPage } from "@/server/session";
import { getAdminOrder } from "@/server/services/admin-orders";

export const metadata: Metadata = { title: "Detail Pesanan" };

export default async function AdminOrderDetailPage({ params }: PageProps<"/admin/pesanan/[id]">) {
  await requireAdminPage();
  const { id } = await params;

  const order = await getAdminOrder(id).catch((error) => {
    if (isDomainError(error) && error.code === "TIDAK_DITEMUKAN") notFound();
    throw error;
  });

  return <AdminOrderDetailView order={order} />;
}

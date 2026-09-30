import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/order/order-detail";
import { isDomainError } from "@/lib/domain/errors";
import { getCustomerOrder } from "@/server/services/customer-orders";
import { requireUserPage } from "@/server/session";

export const metadata: Metadata = { title: "Detail Pesanan", robots: { index: false } };

export default async function OrderDetailPage({ params }: PageProps<"/pesanan/[code]">) {
  const user = await requireUserPage();
  const { code } = await params;

  const order = await getCustomerOrder(user.id, code).catch((error) => {
    if (isDomainError(error) && error.code === "TIDAK_DITEMUKAN") notFound();
    throw error;
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <OrderDetail order={order} />
    </main>
  );
}

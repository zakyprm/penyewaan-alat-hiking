import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRupiah } from "@/lib/format";
import { listCustomerOrders } from "@/server/services/customer-orders";
import { requireUserPage } from "@/server/session";

export const metadata: Metadata = { title: "Pesanan Saya", robots: { index: false } };

export default async function MyOrdersPage() {
  const user = await requireUserPage();
  const orders = await listCustomerOrders(user.id);

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Pesanan Saya</h1>

      {orders.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl bg-card px-4 py-16 text-center ring-1 ring-foreground/10">
          <PackageSearch className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Belum ada pesanan</p>
          <Button asChild>
            <Link href="/alat">Lihat katalog</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => (
            <li key={o.code}>
              <Link
                href={`/pesanan/${o.code}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-secondary/60"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {o.code}
                    <OrderStatusBadge status={o.status} />
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{o.itemSummary}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(o.startAt)} – {formatDate(o.endAt)}
                  </p>
                </div>
                <p className="font-semibold text-primary tabular-nums">{formatRupiah(o.totalDue)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

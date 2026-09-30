import { AlertTriangle, Boxes, CalendarCheck, CalendarClock, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toWibLocal } from "@/lib/datetime-local";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import { dashboardQuerySchema } from "@/lib/validation/dashboard-query";
import { defaultPeriod, getDashboard, type DashboardOrderRow } from "@/server/services/dashboard";
import { requireAdminPage } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_LABEL: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
  DIKONFIRMASI: "Dikonfirmasi",
  DIAMBIL: "Diambil",
  DIKEMBALIKAN: "Dikembalikan",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};
const STATUS_ORDER = ["MENUNGGU_PEMBAYARAN", "DIKONFIRMASI", "DIAMBIL", "DIKEMBALIKAN", "SELESAI", "DIBATALKAN"];

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  await requireAdminPage();
  const query = dashboardQuerySchema.parse(await searchParams);
  const fallback = defaultPeriod();
  const period = query.from && query.to && query.to.getTime() > query.from.getTime() ? { from: query.from, to: query.to } : fallback;
  const data = await getDashboard(period);

  return (
    <div className="grid gap-6">
      <PageHeader title="Dashboard" description="Ringkasan kondisi toko." />

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1.5">
          <Label htmlFor="from">Dari</Label>
          <Input id="from" name="from" type="datetime-local" defaultValue={toWibLocal(period.from)} className="bg-card" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Sampai</Label>
          <Input id="to" name="to" type="datetime-local" defaultValue={toWibLocal(period.to)} className="bg-card" />
        </div>
        <button type="submit" className="h-8 rounded-lg border border-input bg-card px-3 text-sm font-medium">
          Terapkan
        </button>
        <Link href="/admin" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Reset ke 30 hari terakhir
        </Link>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Pendapatan (sewa + denda)" value={formatRupiah(data.revenue.total)} hint={`Sewa ${formatRupiah(data.revenue.rental)} · Denda ${formatRupiah(data.revenue.fines)}`} />
        <StatCard icon={Boxes} label="Unit sedang disewa" value={String(data.itemsCurrentlyRented)} />
        <StatCard icon={CalendarClock} label="Ambil hari ini" value={String(data.pickupsToday.length)} />
        <StatCard icon={CalendarCheck} label="Kembali hari ini" value={String(data.returnsToday.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Pesanan per status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {STATUS_ORDER.map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
                <span className="font-medium tabular-nums">{data.statusCounts[s] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>5 alat paling sering disewa</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
            ) : (
              <ol className="grid gap-2">
                {data.topItems.map((item, i) => (
                  <li key={item.itemId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded-full bg-secondary text-xs font-medium">{i + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{item.timesRented} pesanan · {item.unitsRented} unit</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <OrderListCard title="Ambil hari ini" orders={data.pickupsToday} emptyText="Tidak ada pengambilan hari ini." dateField="startAt" />
        <OrderListCard title="Kembali hari ini" orders={data.returnsToday} emptyText="Tidak ada jatuh tempo hari ini." dateField="endAt" />
        <Card>
          <CardHeader className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
            <CardTitle>Pesanan terlambat</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lateOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada pesanan terlambat.</p>
            ) : (
              <ul className="grid gap-2">
                {data.lateOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/pesanan/${o.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-danger-muted px-2.5 py-1.5 text-sm hover:opacity-80">
                      <span>
                        <span className="font-medium">{o.code}</span> · {o.customerName}
                      </span>
                      <Badge className="bg-destructive text-white">{formatDate(o.endAt)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof TrendingUp; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function OrderListCard({
  title,
  orders,
  emptyText,
  dateField,
}: {
  title: string;
  orders: DashboardOrderRow[];
  emptyText: string;
  dateField: "startAt" | "endAt";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="grid gap-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pesanan/${o.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted">
                  <span>
                    <span className="font-medium">{o.code}</span> · {o.customerName}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(o[dateField])}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

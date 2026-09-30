import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRupiah } from "@/lib/format";
import { ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS } from "@/lib/domain/types";
import { adminOrderListQuerySchema } from "@/lib/validation/admin-order-query";
import { requireAdminPage } from "@/server/session";
import { listAdminOrders } from "@/server/services/admin-orders";

export const metadata: Metadata = { title: "Pesanan" };

const STATUS_LABEL: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
  DIKONFIRMASI: "Dikonfirmasi",
  DIAMBIL: "Diambil",
  DIKEMBALIKAN: "Dikembalikan",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};
const SOURCE_LABEL: Record<string, string> = { ONLINE: "Online", WALK_IN: "Walk-in" };
const METHOD_LABEL: Record<string, string> = { ONLINE: "Online", BAYAR_DI_TOKO: "Bayar di Toko" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/pesanan">) {
  await requireAdminPage();
  const query = adminOrderListQuerySchema.parse(await searchParams);
  const orders = await listAdminOrders(query);

  return (
    <div className="grid gap-6">
      <PageHeader title="Pesanan" description="Kelola pesanan online dan walk-in." />

      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Cari kode, nama, atau nomor HP
        </label>
        <Input id="q" name="q" type="search" placeholder="Cari kode, nama, atau nomor HP" defaultValue={query.q} className="w-64 bg-card" />

        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={query.status ?? ""} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">Semua status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <label htmlFor="source" className="sr-only">
          Sumber
        </label>
        <select id="source" name="source" defaultValue={query.source ?? ""} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">Semua sumber</option>
          {ORDER_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>

        <label htmlFor="method" className="sr-only">
          Metode bayar
        </label>
        <select id="method" name="method" defaultValue={query.method ?? ""} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">Semua metode</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>

        <button type="submit" className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium">
          <Search className="size-4" aria-hidden="true" />
          Cari
        </button>
      </form>

      <Card className="py-0">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Tidak ada pesanan yang cocok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Kode</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Alat</TableHead>
                <TableHead>Waktu sewa</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Sumber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/pesanan/${o.id}`} className="font-medium hover:underline">
                      {o.code}
                    </Link>
                    {o.timeliness === "TERLAMBAT" && <Badge className="ml-2 bg-danger-muted text-destructive">Terlambat</Badge>}
                    {o.timeliness === "DALAM_GRACE" && <Badge className="ml-2 bg-warning-muted text-warning">Dalam grace</Badge>}
                  </TableCell>
                  <TableCell>
                    <p>{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">{o.customerPhone}</p>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground" title={o.itemSummary}>
                    {o.itemSummary}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(o.startAt)} – {formatDate(o.endAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(o.totalDue)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-sm text-muted-foreground">{SOURCE_LABEL[o.source]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-sm text-muted-foreground">{orders.length} pesanan</p>
    </div>
  );
}

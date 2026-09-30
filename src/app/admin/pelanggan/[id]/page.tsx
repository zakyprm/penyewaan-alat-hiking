import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isDomainError } from "@/lib/domain/errors";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import { getCustomerDetail } from "@/server/services/customers";
import { requireAdminPage } from "@/server/session";

export const metadata: Metadata = { title: "Detail Pelanggan" };

export default async function AdminCustomerDetailPage({ params }: PageProps<"/admin/pelanggan/[id]">) {
  await requireAdminPage();
  const { id } = await params;

  const customer = await getCustomerDetail(id).catch((error) => {
    if (isDomainError(error) && error.code === "TIDAK_DITEMUKAN") notFound();
    throw error;
  });

  return (
    <div className="grid gap-6">
      <PageHeader title={customer.name} description={`Terdaftar sejak ${formatDateTime(customer.createdAt)}`} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Kontak</p>
          <p className="font-medium">{customer.email}</p>
          {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total denda sepanjang riwayat</p>
          <p className={`text-lg font-semibold ${customer.totalFines > 0 ? "text-destructive" : ""}`}>{formatRupiah(customer.totalFines)}</p>
        </Card>
      </div>

      <Card className="py-0">
        {customer.orders.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Belum ada pesanan.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Kode</TableHead>
                <TableHead>Waktu sewa</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Denda</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.orders.map((o) => (
                <TableRow key={o.code}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/pesanan?q=${encodeURIComponent(o.code)}`} className="font-medium hover:underline">
                      {o.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(o.startAt)} – {formatDate(o.endAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(o.totalDue)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${o.totalFines > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {formatRupiah(o.totalFines)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRupiah } from "@/lib/format";
import { requireAdminPage } from "@/server/session";
import { listCustomers } from "@/server/services/customers";

export const metadata: Metadata = { title: "Pelanggan" };

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/pelanggan">) {
  await requireAdminPage();
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q : "";
  const customers = await listCustomers(query);

  return (
    <div className="grid gap-6">
      <PageHeader title="Pelanggan" description="Daftar pelanggan yang sudah mendaftar akun." />

      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Cari nama, email, atau nomor HP
        </label>
        <Input id="q" name="q" type="search" placeholder="Cari nama, email, atau nomor HP" defaultValue={query} className="w-72 bg-card" />
        <button type="submit" className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium">
          <Search className="size-4" aria-hidden="true" />
          Cari
        </button>
      </form>

      <Card className="py-0">
        {customers.length === 0 ? (
          <div className="grid justify-items-center gap-2 p-10 text-center text-muted-foreground">
            <Users className="size-8" aria-hidden="true" />
            <p>{query ? "Tidak ada pelanggan yang cocok." : "Belum ada pelanggan terdaftar."}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Terdaftar</TableHead>
                <TableHead className="text-right">Pesanan</TableHead>
                <TableHead className="pr-4 text-right">Total denda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/pelanggan/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{c.email}</p>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {c.totalFines > 0 ? (
                      <Badge className="bg-danger-muted text-destructive">{formatRupiah(c.totalFines)}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{formatRupiah(0)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-sm text-muted-foreground">{customers.length} pelanggan</p>
    </div>
  );
}

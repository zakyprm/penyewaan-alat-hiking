import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ItemBadges } from "@/components/admin/item-badges";
import { ItemThumb } from "@/components/admin/item-thumb";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adminItemListQuerySchema, type AdminItemFilter } from "@/lib/validation/catalog";
import { requireAdminPage } from "@/server/session";
import { listCategories } from "@/server/services/categories";
import { listAdminItems } from "@/server/services/items";

export const metadata: Metadata = { title: "Alat" };

const TABS: { value: AdminItemFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "publik", label: "Publik" },
  { value: "internal", label: "Internal" },
  { value: "nonaktif", label: "Nonaktif" },
];

export default async function AdminItemsPage({ searchParams }: PageProps<"/admin/alat">) {
  await requireAdminPage();
  const query = adminItemListQuerySchema.parse(await searchParams);
  const [items, categories] = await Promise.all([listAdminItems(query), listCategories()]);

  const hrefFor = (status: AdminItemFilter) => {
    const params = new URLSearchParams();
    if (status !== "semua") params.set("status", status);
    if (query.q) params.set("q", query.q);
    if (query.kategori) params.set("kategori", query.kategori);
    const qs = params.toString();
    return qs ? `/admin/alat?${qs}` : "/admin/alat";
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Alat"
        description="Alat Publik tampil di katalog. Alat Internal hanya untuk sewa langsung di toko."
        actions={
          <Button asChild>
            <Link href="/admin/alat/baru">
              <Plus aria-hidden="true" />
              Tambah Alat
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter status" className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={hrefFor(tab.value)}
              aria-current={query.status === tab.value ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium",
                query.status === tab.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Form GET biasa: filter tetap jalan tanpa JavaScript */}
        <form className="flex flex-wrap gap-2" role="search">
          {query.status !== "semua" && <input type="hidden" name="status" value={query.status} />}
          <label htmlFor="kategori" className="sr-only">
            Kategori
          </label>
          <select
            id="kategori"
            name="kategori"
            defaultValue={query.kategori ?? ""}
            className="h-8 rounded-lg border border-input bg-card px-2 text-sm"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label htmlFor="q" className="sr-only">
            Cari alat
          </label>
          <Input id="q" name="q" type="search" placeholder="Cari nama alat" defaultValue={query.q} className="w-48 bg-card" />
          <Button type="submit" variant="outline">
            <Search aria-hidden="true" />
            Cari
          </Button>
        </form>
      </div>

      <Card className="py-0">
        {items.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            {query.q || query.kategori || query.status !== "semua" ? "Tidak ada alat yang cocok." : "Belum ada alat."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Alat</TableHead>
                <TableHead className="pr-4 text-right sm:pr-2">Harga/hari</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Deposit</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Stok</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <ItemThumb src={item.images[0]} alt="" />
                      <div className="min-w-0">
                        <Link href={`/admin/alat/${item.id}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                        {/* Di layar kecil, kolom yang disembunyikan pindah ke sini */}
                        <div className="mt-1 grid gap-1 sm:hidden">
                          <p className="text-xs text-muted-foreground">
                            Stok {item.stock} · Deposit {formatRupiah(item.depositPerUnit)}
                          </p>
                          <ItemBadges visibility={item.visibility} isActive={item.isActive} allowKtp={item.allowKtp} />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right align-top tabular-nums sm:pr-2 sm:align-middle">
                    {formatRupiah(item.pricePerDay)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {formatRupiah(item.depositPerUnit)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{item.stock}</TableCell>
                  <TableCell className="hidden pr-4 sm:table-cell">
                    <ItemBadges visibility={item.visibility} isActive={item.isActive} allowKtp={item.allowKtp} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-sm text-muted-foreground">{items.length} alat</p>
    </div>
  );
}

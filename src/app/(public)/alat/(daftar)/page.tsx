import { CalendarRange, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ItemCard } from "@/components/catalog/item-card";
import { MobileFilterSheet } from "@/components/catalog/mobile-filter-sheet";
import { Pagination } from "@/components/catalog/pagination";
import { Button } from "@/components/ui/button";
import { toWibLocal } from "@/lib/datetime-local";
import { formatDateTime } from "@/lib/format";
import { catalogQuerySchema } from "@/lib/validation/catalog-query";
import { listCatalog, listCatalogCategories } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: "Katalog Alat",
  description: "Cari dan sewa tenda, carrier, sleeping bag, alat masak, dan perlengkapan hiking lainnya.",
};

export default async function CatalogPage({ searchParams }: PageProps<"/alat">) {
  const query = catalogQuerySchema.parse(await searchParams);
  const [result, categories] = await Promise.all([listCatalog(query), listCatalogCategories()]);

  // Parameter aktif, dipakai untuk paginasi dan untuk meneruskan waktu sewa ke halaman detail
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.window) {
    params.set("start", toWibLocal(query.window.start));
    params.set("end", toWibLocal(query.window.end));
  }
  if (query.sort !== "nama") params.set("sort", query.sort);

  const hrefFor = (page: number) => {
    const p = new URLSearchParams(params);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return qs ? `/alat?${qs}` : "/alat";
  };

  const windowParams = query.window
    ? new URLSearchParams({ start: toWibLocal(query.window.start), end: toWibLocal(query.window.end) }).toString()
    : undefined;
  const invalidWindow = query.start && query.end && !query.window;
  const activeCount = [
    query.q,
    query.category,
    query.minPrice ?? query.maxPrice,
    query.window,
  ].filter((v) => v !== undefined).length;
  const categoryName = categories.find((c) => c.slug === query.category)?.name;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[16rem_1fr] lg:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <CatalogFilters query={query} categories={categories} idPrefix="d-" />
        </div>
      </aside>

      <section aria-labelledby="katalog-heading" className="grid content-start gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="katalog-heading" className="text-2xl font-semibold tracking-tight">
              {categoryName ?? "Katalog alat"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {result.total} alat{query.q ? ` untuk "${query.q}"` : ""}
            </p>
          </div>
          <MobileFilterSheet activeCount={activeCount}>
            <CatalogFilters query={query} categories={categories} idPrefix="m-" stickyActions />
          </MobileFilterSheet>
        </div>

        {query.window && (
          <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
            <CalendarRange className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Hanya alat yang tersedia {formatDateTime(query.window.start)} sampai {formatDateTime(query.window.end)}.
            </span>
          </p>
        )}
        {invalidWindow && (
          <p role="alert" className="rounded-lg bg-warning-muted px-3 py-2 text-sm text-warning">
            Waktu kembali harus setelah waktu ambil. Filter tanggal tidak dipakai.
          </p>
        )}

        {result.items.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-xl bg-card px-4 py-16 text-center ring-1 ring-foreground/10">
            <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Tidak ada alat yang cocok</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {query.window
                ? "Semua alat yang cocok sudah dipesan pada waktu itu. Coba tanggal lain atau hapus sebagian filter."
                : "Coba kata kunci lain atau hapus sebagian filter."}
            </p>
            <Button asChild variant="outline">
              <Link href="/alat">Lihat semua alat</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {result.items.map((item) => (
              <li key={item.id} className="grid">
                <ItemCard item={item} query={windowParams} />
              </li>
            ))}
          </ul>
        )}

        <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
      </section>
    </main>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toWibLocal } from "@/lib/datetime-local";
import type { CatalogQuery } from "@/lib/validation/catalog-query";

interface Props {
  query: CatalogQuery;
  categories: { slug: string; name: string }[];
  /** Awalan id supaya form desktop dan mobile tidak bentrok */
  idPrefix: string;
  /** Tombol menempel di bawah (dipakai di bottom sheet mobile) */
  stickyActions?: boolean;
}

const selectClass = "h-8 w-full rounded-lg border border-input bg-card px-2 text-sm";

/**
 * Form filter katalog dengan method GET biasa: hasilnya URL yang bisa dibagikan,
 * dan tetap berfungsi walau JavaScript belum dimuat.
 */
export function CatalogFilters({ query, categories, idPrefix, stickyActions }: Props) {
  const id = (name: string) => `${idPrefix}${name}`;

  return (
    <form action="/alat" className="grid gap-5" role="search" aria-label="Filter katalog">
      <div className="grid gap-1.5">
        <Label htmlFor={id("q")}>Cari alat</Label>
        <Input id={id("q")} name="q" type="search" placeholder="Misal: tenda" defaultValue={query.q} className="bg-card" />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Waktu sewa</legend>
        <p className="text-xs text-muted-foreground">Isi keduanya untuk melihat alat yang tersedia saja.</p>
        <div className="grid gap-1">
          <Label htmlFor={id("start")} className="text-xs font-normal text-muted-foreground">
            Ambil
          </Label>
          <Input
            id={id("start")}
            name="start"
            type="datetime-local"
            step={1800}
            defaultValue={query.start ? toWibLocal(query.start) : undefined}
            className="bg-card"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={id("end")} className="text-xs font-normal text-muted-foreground">
            Kembali
          </Label>
          <Input
            id={id("end")}
            name="end"
            type="datetime-local"
            step={1800}
            defaultValue={query.end ? toWibLocal(query.end) : undefined}
            className="bg-card"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">Kategori</legend>
        {[{ slug: "", name: "Semua kategori" }, ...categories].map((c) => (
          <label key={c.slug || "semua"} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="category"
              value={c.slug}
              defaultChecked={(query.category ?? "") === c.slug}
              className="size-4 accent-primary"
            />
            {c.name}
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Harga per hari (Rp)</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor={id("minPrice")} className="text-xs font-normal text-muted-foreground">
              Minimal
            </Label>
            <Input
              id={id("minPrice")}
              name="minPrice"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              defaultValue={query.minPrice}
              className="bg-card"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={id("maxPrice")} className="text-xs font-normal text-muted-foreground">
              Maksimal
            </Label>
            <Input
              id={id("maxPrice")}
              name="maxPrice"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              defaultValue={query.maxPrice}
              className="bg-card"
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor={id("sort")}>Urutkan</Label>
        <select id={id("sort")} name="sort" defaultValue={query.sort} className={selectClass}>
          <option value="nama">Nama (A–Z)</option>
          <option value="termurah">Harga termurah</option>
          <option value="termahal">Harga termahal</option>
        </select>
      </div>

      <div className={stickyActions ? "sticky bottom-0 -mx-4 flex gap-2 border-t bg-popover px-4 py-3" : "flex gap-2"}>
        <Button type="submit" className="flex-1">
          Terapkan
        </Button>
        <Button asChild variant="outline">
          <Link href="/alat">Reset</Link>
        </Button>
      </div>
    </form>
  );
}

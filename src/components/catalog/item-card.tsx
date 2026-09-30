import Image from "next/image";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import type { CatalogItem } from "@/server/services/catalog";
import { CategoryIcon } from "./category-icon";

/** Kartu alat di katalog (Req 2.5). `query` meneruskan waktu sewa ke halaman detail. */
export function ItemCard({ item, query }: { item: CatalogItem; query?: string }) {
  const href = `/alat/${item.slug}${query ? `?${query}` : ""}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="relative aspect-4/3 bg-secondary">
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <CategoryIcon slug={item.categorySlug} className="absolute inset-0 m-auto size-12 text-primary/40" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-xs text-muted-foreground">{item.categoryName}</p>
        <h3 className="leading-snug font-medium group-hover:underline">{item.name}</h3>
        <p className="mt-auto pt-2 text-sm">
          <span className="font-semibold text-primary">{formatRupiah(item.pricePerDay)}</span>
          <span className="text-muted-foreground"> / hari</span>
        </p>
      </div>
    </Link>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/** Kerangka katalog selama data dimuat (Req 18, design 8.1). */
export default function CatalogLoading() {
  return (
    <main
      className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[16rem_1fr] lg:gap-8"
      aria-busy="true"
      aria-label="Memuat katalog"
    >
      <div className="hidden gap-4 lg:grid lg:content-start">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="grid content-start gap-5">
        <Skeleton className="h-8 w-48" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="grid gap-2">
              <Skeleton className="aspect-4/3 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

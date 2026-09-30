import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  totalPages: number;
  /** Membuat URL untuk nomor halaman tertentu */
  hrefFor: (page: number) => string;
}

export function Pagination({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null;
  const item = "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium";

  return (
    <nav aria-label="Halaman katalog" className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "hover:bg-muted")} aria-label="Halaman sebelumnya">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(item, "opacity-40")} aria-hidden="true">
          <ChevronLeft className="size-4" />
        </span>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          aria-current={n === page ? "page" : undefined}
          aria-label={`Halaman ${n}`}
          className={cn(item, n === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {n}
        </Link>
      ))}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "hover:bg-muted")} aria-label="Halaman berikutnya">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(item, "opacity-40")} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

import { Package } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Foto utama alat, atau ikon jika belum ada foto. */
export function ItemThumb({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  return (
    <div className={cn("relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="96px" className="object-cover" />
      ) : (
        <Package className="absolute inset-0 m-auto size-5 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

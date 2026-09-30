"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

export function ItemGallery({ images, name, categorySlug }: { images: string[]; name: string; categorySlug: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
        <CategoryIcon slug={categorySlug} className="absolute inset-0 m-auto size-24 text-primary/30" />
        <span className="sr-only">Belum ada foto untuk {name}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
        <Image
          src={images[active]}
          alt={`${name}, foto ${active + 1} dari ${images.length}`}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2" aria-label="Pilih foto">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Tampilkan foto ${i + 1}`}
                aria-pressed={i === active}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg ring-2 ring-transparent focus-visible:ring-ring focus-visible:outline-none",
                  i === active && "ring-primary",
                )}
              >
                <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

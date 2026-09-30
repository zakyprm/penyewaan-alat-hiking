import { Backpack, BedDouble, CookingPot, Flashlight, Footprints, Package, Tent, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  tenda: Tent,
  "sepatu-hiking": Footprints,
  carrier: Backpack,
  "sleeping-bag": BedDouble,
  "alat-masak": CookingPot,
  penerangan: Flashlight,
};

/** Ikon kategori; juga dipakai sebagai pengganti foto alat yang belum diunggah. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? Package;
  return <Icon className={className} aria-hidden="true" />;
}

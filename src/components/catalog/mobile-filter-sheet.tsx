"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Filter katalog sebagai bottom sheet di layar kecil (design 8.1). Isi form dirender server. */
export function MobileFilterSheet({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal aria-hidden="true" />
          Filter{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-2 overflow-y-auto rounded-t-2xl px-4 pb-0"
        // Jangan langsung fokus ke kolom pencarian: keyboard HP akan menutupi filter lain
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-0">
          <SheetTitle>Filter alat</SheetTitle>
          <SheetDescription className="sr-only">Saring katalog berdasarkan waktu, kategori, dan harga.</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

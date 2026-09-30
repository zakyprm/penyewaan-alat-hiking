"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";

export function CartButton() {
  const hydrated = useHydrated();
  const count = useCart((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0));
  const shown = hydrated ? count : 0;

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/keranjang" aria-label={shown > 0 ? `Keranjang, ${shown} alat` : "Keranjang"}>
        <ShoppingBag />
        {shown > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-earth px-1 text-[0.65rem] leading-4.5 font-semibold text-earth-foreground"
          >
            {shown > 99 ? "99+" : shown}
          </span>
        )}
      </Link>
    </Button>
  );
}

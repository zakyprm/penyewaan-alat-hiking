import { LayoutDashboard, Mountain, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/session";
import { CartButton } from "./cart-button";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold text-primary">
          <Mountain className="size-5" aria-hidden="true" />
          <span>Sewa Alat Hiking</span>
        </Link>

        <nav aria-label="Menu utama" className="hidden items-center gap-1 text-sm sm:flex">
          <Link href="/alat" className="rounded-md px-3 py-1.5 font-medium hover:bg-muted">
            Katalog
          </Link>
          <Link href="/#cara-sewa" className="rounded-md px-3 py-1.5 font-medium hover:bg-muted">
            Cara Sewa
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" className="sm:hidden">
            <Link href="/alat">Katalog</Link>
          </Button>
          <CartButton />
          {user ? (
            <>
              {user.role === "ADMIN" && (
                <Button asChild variant="ghost" size="icon" className="sm:w-auto sm:px-2.5">
                  <Link href="/admin" aria-label="Admin">
                    <LayoutDashboard />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" className="sm:w-auto sm:px-2.5">
                <Link href="/pesanan" aria-label="Pesanan saya">
                  <UserRound />
                  <span className="hidden sm:inline">Pesanan</span>
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="ml-1">
              <Link href="/masuk">Masuk</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

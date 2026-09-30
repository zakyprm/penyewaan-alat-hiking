import { Mountain } from "lucide-react";
import Link from "next/link";
import { getSettings } from "@/server/services/settings";

export async function SiteFooter() {
  const settings = await getSettings();
  const hours = `${String(settings.openHour).padStart(2, "0")}.00–${String(settings.closeHour).padStart(2, "0")}.00 WIB`;

  return (
    <footer className="mt-16 border-t bg-muted/50">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
        <div className="grid content-start gap-2">
          <span className="flex items-center gap-2 font-semibold text-primary">
            <Mountain className="size-5" aria-hidden="true" />
            Sewa Alat Hiking
          </span>
          <p className="text-muted-foreground">Perlengkapan mendaki yang bersih dan siap pakai.</p>
        </div>
        <div className="grid content-start gap-1">
          <p className="font-medium">Jam operasional</p>
          <p className="text-muted-foreground">Setiap hari, {hours}</p>
        </div>
        <nav aria-label="Tautan footer" className="grid content-start gap-1">
          <Link href="/alat" className="text-muted-foreground hover:text-foreground">
            Katalog alat
          </Link>
          <Link href="/#cara-sewa" className="text-muted-foreground hover:text-foreground">
            Cara sewa
          </Link>
          <Link href="/pesanan" className="text-muted-foreground hover:text-foreground">
            Pesanan saya
          </Link>
        </nav>
      </div>
    </footer>
  );
}

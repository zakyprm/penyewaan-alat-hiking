import { ArrowRight, CalendarCheck, Clock, IdCard, PackageCheck, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { ItemCard } from "@/components/catalog/item-card";
import { Button } from "@/components/ui/button";
import { listCatalogCategories, listFeaturedItems } from "@/server/services/catalog";
import { getSettings } from "@/server/services/settings";

const STEPS = [
  { icon: Search, title: "Pilih alat dan tanggal", text: "Cari di katalog, lalu pilih waktu ambil dan kembali. Stok langsung dicek." },
  { icon: Wallet, title: "Pesan dan bayar", text: "Bayar online, atau bayar saat mengambil alat di toko." },
  { icon: PackageCheck, title: "Ambil, mendaki, kembalikan", text: "Ambil alat di toko sesuai jadwal, lalu kembalikan setelah pulang." },
];

export default async function HomePage() {
  const [categories, featured, settings] = await Promise.all([
    listCatalogCategories(),
    listFeaturedItems(8),
    getSettings(),
  ]);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 1200 240"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 w-full text-background sm:h-44"
        >
          <path d="M0 240 L0 170 L180 70 L300 150 L470 20 L640 160 L760 90 L900 170 L1040 60 L1200 150 L1200 240 Z" fill="currentColor" opacity="0.08" />
          <path d="M0 240 L0 200 L220 120 L380 190 L560 110 L760 200 L960 130 L1200 200 L1200 240 Z" fill="currentColor" />
        </svg>
        <div className="relative mx-auto grid w-full max-w-6xl gap-6 px-4 pt-14 pb-36 sm:pt-20 sm:pb-48">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Perlengkapan mendaki, siap kapan pun kamu berangkat.
          </h1>
          <p className="max-w-xl text-primary-foreground/85 sm:text-lg">
            Sewa tenda, carrier, sleeping bag, dan alat masak. Cek ketersediaan per tanggal, pesan online, ambil di toko.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-background px-4 text-primary hover:bg-background/90">
              <Link href="/alat">
                Lihat Alat
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent px-4 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="#cara-sewa">Cara Sewa</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-16 px-4 py-4">
        {/* Kategori */}
        {categories.length > 0 && (
          <section aria-labelledby="kategori-heading" className="grid gap-4">
            <h2 id="kategori-heading" className="text-xl font-semibold">
              Kategori
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/alat?category=${c.slug}`}
                    className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 text-center ring-1 ring-foreground/10 transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <CategoryIcon slug={c.slug} className="size-7 text-primary" />
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.itemCount} alat</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Alat unggulan */}
        {featured.length > 0 && (
          <section aria-labelledby="unggulan-heading" className="grid gap-4">
            <div className="flex items-end justify-between gap-4">
              <h2 id="unggulan-heading" className="text-xl font-semibold">
                Alat pilihan
              </h2>
              <Link href="/alat" className="text-sm font-medium text-primary hover:underline">
                Semua alat
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((item) => (
                <li key={item.id} className="grid">
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cara sewa */}
        <section id="cara-sewa" aria-labelledby="cara-heading" className="grid scroll-mt-20 gap-4">
          <h2 id="cara-heading" className="text-xl font-semibold">
            Cara sewa
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="grid content-start gap-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <span className="flex items-center gap-2 text-sm font-medium text-earth">
                  <Icon className="size-5" aria-hidden="true" />
                  Langkah {i + 1}
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Info jaminan dan keterlambatan */}
        <section aria-labelledby="ketentuan-heading" className="grid gap-4">
          <h2 id="ketentuan-heading" className="text-xl font-semibold">
            Ketentuan singkat
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Info icon={IdCard} title="Pilih jaminanmu">
              {settings.depositEnabled && settings.ktpEnabled
                ? "Deposit uang (dikembalikan setelah alat kembali) atau KTP asli yang dititipkan di toko."
                : settings.ktpEnabled
                  ? "Titipkan KTP asli di toko saat mengambil alat."
                  : "Deposit uang, dikembalikan setelah alat kembali dalam kondisi baik."}
            </Info>
            <Info icon={Clock} title={`Toleransi ${settings.graceHours} jam`}>
              Terlambat mengembalikan sampai {settings.graceHours} jam dari jatuh tempo tidak dikenakan denda.
            </Info>
            <Info icon={CalendarCheck} title="Denda keterlambatan">
              Lewat dari toleransi, denda {settings.lateFinePercent}% dari harga sewa per hari untuk setiap hari
              keterlambatan.
            </Info>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-secondary p-5">
      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="grid gap-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

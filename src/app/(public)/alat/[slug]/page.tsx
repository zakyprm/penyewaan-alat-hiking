import { ChevronRight, IdCard, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookingPanel } from "@/components/catalog/booking-panel";
import { ItemGallery } from "@/components/catalog/item-gallery";
import { parseWibLocal } from "@/lib/datetime-local";
import { isDomainError } from "@/lib/domain/errors";
import { formatRupiah } from "@/lib/format";
import { getCatalogItem } from "@/server/services/catalog";
import { getSettings } from "@/server/services/settings";

// Satu query per request walau dipakai generateMetadata dan page
const loadItem = cache(async (slug: string) =>
  getCatalogItem(slug).catch((error) => {
    if (isDomainError(error) && error.code === "TIDAK_DITEMUKAN") notFound();
    throw error;
  }),
);

export async function generateMetadata({ params }: PageProps<"/alat/[slug]">): Promise<Metadata> {
  const item = await loadItem((await params).slug);
  return {
    title: item.name,
    description: item.description ?? `Sewa ${item.name} mulai ${formatRupiah(item.pricePerDay)} per hari.`,
    openGraph: item.images[0] ? { images: [item.images[0]] } : undefined,
  };
}

const localParam = (value: string | string[] | undefined) =>
  typeof value === "string" && parseWibLocal(value) ? value : null;

export default async function ItemDetailPage({ params, searchParams }: PageProps<"/alat/[slug]">) {
  const [item, settings, sp] = await Promise.all([loadItem((await params).slug), getSettings(), searchParams]);

  const ktpAvailable = settings.ktpEnabled && item.allowKtp;
  const specs = item.specs ? Object.entries(item.specs) : [];

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/alat" className="hover:text-foreground">
              Katalog
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href={`/alat?category=${item.categorySlug}`} className="hover:text-foreground">
              {item.categoryName}
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li aria-current="page" className="text-foreground">
            {item.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <ItemGallery images={item.images} name={item.name} categorySlug={item.categorySlug} />

        <div className="grid content-start gap-6">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-earth">{item.categoryName}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{item.name}</h1>
            <p className="text-lg">
              <span className="font-semibold text-primary">{formatRupiah(item.pricePerDay)}</span>
              <span className="text-muted-foreground"> / hari</span>
            </p>
          </div>

          <ul className="grid gap-2 text-sm">
            {settings.depositEnabled && (
              <li className="flex items-start gap-2">
                <Wallet className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Jaminan deposit {formatRupiah(item.depositPerUnit)} per unit, dikembalikan setelah alat kembali.
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <IdCard className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {ktpAvailable
                  ? "Bisa juga dijamin dengan KTP asli yang dititipkan di toko."
                  : settings.ktpEnabled
                    ? "Alat ini tidak bisa dijamin dengan KTP, hanya deposit."
                    : "Jaminan KTP sedang tidak tersedia."}
              </span>
            </li>
          </ul>

          <section aria-labelledby="sewa-heading" className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
            <h2 id="sewa-heading" className="font-semibold">
              Sewa alat ini
            </h2>
            <BookingPanel
              item={{
                id: item.id,
                slug: item.slug,
                name: item.name,
                image: item.image,
                categorySlug: item.categorySlug,
                pricePerDay: item.pricePerDay,
                depositPerUnit: item.depositPerUnit,
                allowKtp: item.allowKtp,
              }}
              openHour={settings.openHour}
              closeHour={settings.closeHour}
              initialStart={localParam(sp.start)}
              initialEnd={localParam(sp.end)}
            />
          </section>
        </div>
      </div>

      {(item.description || specs.length > 0) && (
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          {item.description && (
            <section aria-labelledby="deskripsi-heading" className="grid content-start gap-2">
              <h2 id="deskripsi-heading" className="text-lg font-semibold">
                Deskripsi
              </h2>
              <p className="whitespace-pre-line text-muted-foreground">{item.description}</p>
            </section>
          )}
          {specs.length > 0 && (
            <section aria-labelledby="spesifikasi-heading" className="grid content-start gap-2">
              <h2 id="spesifikasi-heading" className="text-lg font-semibold">
                Spesifikasi
              </h2>
              <dl className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
                {specs.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-2 gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, IdCard, Loader2, Minus, Plus, ShoppingBag, Trash2, Wallet, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useCart, type CartLine } from "@/lib/cart-store";
import { parseWibLocal, toWibLocal } from "@/lib/datetime-local";
import { MIN_ONLINE_LEAD_MINUTES } from "@/lib/domain/schedule";
import { formatRupiah } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";
import type { CartQuote, QuoteLine } from "@/server/services/cart";

export function CartView({ openHour, closeHour }: { openHour: number; closeHour: number }) {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);

  if (!hydrated) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]" aria-busy="true">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-xl bg-card px-4 py-16 text-center ring-1 ring-foreground/10">
        <ShoppingBag className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Keranjang masih kosong</p>
        <p className="max-w-sm text-sm text-muted-foreground">Pilih alat dan waktu sewa di katalog, lalu tambahkan ke sini.</p>
        <Button asChild>
          <Link href="/alat">Lihat katalog</Link>
        </Button>
      </div>
    );
  }

  return <CartContent openHour={openHour} closeHour={closeHour} />;
}

function CartContent({ openHour, closeHour }: { openHour: number; closeHour: number }) {
  const ids = useId();
  const cart = useCart();
  const now = useNow();

  // Draf input; keranjang hanya diperbarui jika kedua waktu valid (Req 4.1, 4.2)
  const [startInput, setStartInput] = useState(() => (cart.startAt ? toWibLocal(new Date(cart.startAt)) : ""));
  const [endInput, setEndInput] = useState(() => (cart.endAt ? toWibLocal(new Date(cart.endAt)) : ""));
  const draftStart = parseWibLocal(startInput);
  const draftEnd = parseWibLocal(endInput);
  const draftError =
    !draftStart || !draftEnd
      ? "Isi waktu ambil dan kembali."
      : draftEnd <= draftStart
        ? "Waktu kembali harus setelah waktu ambil."
        : null;

  function updateWindow(nextStart: string, nextEnd: string) {
    const s = parseWibLocal(nextStart);
    const e = parseWibLocal(nextEnd);
    if (s && e && e > s) cart.setWindow({ startAt: s.toISOString(), endAt: e.toISOString() });
  }

  const payload = {
    items: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    startAt: cart.startAt,
    endAt: cart.endAt,
  };
  const quote = useQuery({
    queryKey: ["quote", payload],
    queryFn: ({ signal }) => api<CartQuote>("/quote", { json: payload, signal }),
    enabled: Boolean(cart.startAt && cart.endAt) && !draftError,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const data = draftError ? undefined : quote.data;
  const quoteById = new Map(data?.lines.map((l) => [l.itemId, l]));
  const minStart = toWibLocal(new Date(now + MIN_ONLINE_LEAD_MINUTES * 60_000));
  const hoursText = `${String(openHour).padStart(2, "0")}.00–${String(closeHour).padStart(2, "0")}.00 WIB`;
  const problemCount = data?.lines.filter((l) => l.status === "STOK_KURANG" || l.status === "TIDAK_TERSEDIA").length ?? 0;
  const ktp = data?.guaranteeOptions.find((o) => o.type === "KTP");
  const deposit = data?.guaranteeOptions.find((o) => o.type === "DEPOSIT");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid gap-4">
        <section aria-labelledby="waktu-heading" className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 id="waktu-heading" className="font-semibold">
            Waktu sewa untuk semua alat
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${ids}-start`}>Ambil</Label>
              <Input
                id={`${ids}-start`}
                type="datetime-local"
                step={1800}
                min={minStart}
                value={startInput}
                onChange={(e) => {
                  setStartInput(e.target.value);
                  updateWindow(e.target.value, endInput);
                }}
                aria-describedby={`${ids}-hint`}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${ids}-end`}>Kembali</Label>
              <Input
                id={`${ids}-end`}
                type="datetime-local"
                step={1800}
                min={startInput || minStart}
                value={endInput}
                onChange={(e) => {
                  setEndInput(e.target.value);
                  updateWindow(startInput, e.target.value);
                }}
                aria-describedby={`${ids}-hint`}
              />
            </div>
          </div>
          <p id={`${ids}-hint`} className="text-xs text-muted-foreground">
            Jam toko {hoursText}. Mengubah waktu akan mengecek ulang stok semua alat.
          </p>
          <div aria-live="polite">
            {(draftError ?? data?.windowIssue?.message) && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="size-4 shrink-0" aria-hidden="true" />
                {draftError ?? data?.windowIssue?.message}
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="alat-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 id="alat-heading" className="font-semibold">
              Alat ({cart.lines.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={() => cart.clear()}>
              Kosongkan
            </Button>
          </div>
          {problemCount > 0 && (
            <p role="alert" className="flex items-start gap-2 border-b bg-warning-muted px-4 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {problemCount} alat perlu disesuaikan sebelum checkout.
            </p>
          )}
          <ul className="divide-y">
            {cart.lines.map((line) => (
              <CartRow
                key={line.itemId}
                line={line}
                quote={quoteById.get(line.itemId)}
                loading={quote.isFetching}
                onQuantity={(q) => cart.setQuantity(line.itemId, q)}
                onRemove={() => cart.removeLine(line.itemId)}
              />
            ))}
          </ul>
        </section>
      </div>

      <aside aria-labelledby="ringkasan-heading" className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:sticky lg:top-20">
        <h2 id="ringkasan-heading" className="font-semibold">
          Ringkasan
        </h2>
        {quote.isError && !draftError ? (
          <p className="text-sm text-destructive">{quote.error.message}</p>
        ) : !data ? (
          <div className="grid gap-2" aria-busy="true">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : (
          <>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Lama sewa</dt>
                <dd>{data.days} hari</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Biaya sewa</dt>
                <dd className="font-semibold tabular-nums">{formatRupiah(data.rentalSubtotal)}</dd>
              </div>
            </dl>

            <div className="grid gap-2 border-t pt-3 text-sm">
              <p className="font-medium">Jaminan (dipilih saat checkout)</p>
              <GuaranteeRow
                icon={Wallet}
                title="Deposit uang"
                available={deposit?.available ?? false}
                text={deposit?.available ? `+ ${formatRupiah(data.depositTotal)}, dikembalikan setelah alat kembali` : deposit?.reason}
              />
              <GuaranteeRow
                icon={IdCard}
                title="KTP asli"
                available={ktp?.available ?? false}
                text={ktp?.available ? "Tanpa biaya tambahan, dititipkan saat ambil alat" : ktp?.reason}
              />
            </div>

            <div className="flex items-baseline justify-between gap-2 border-t pt-3">
              <span className="text-sm text-muted-foreground">Mulai dari</span>
              <span className="text-lg font-semibold text-primary tabular-nums">{formatRupiah(data.rentalSubtotal)}</span>
            </div>
          </>
        )}

        {data?.canCheckout && !draftError ? (
          <Button asChild size="lg" className="h-11 w-full">
            <Link href="/checkout">Lanjut ke Checkout</Link>
          </Button>
        ) : (
          <Button size="lg" className="h-11 w-full" disabled>
            {quote.isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
            Lanjut ke Checkout
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Keranjang tidak mengunci stok. Stok dicek lagi saat pesanan dibuat.</p>
      </aside>
    </div>
  );
}

function GuaranteeRow({
  icon: Icon,
  title,
  available,
  text,
}: {
  icon: typeof Wallet;
  title: string;
  available: boolean;
  text?: string;
}) {
  return (
    <div className={available ? "flex gap-2" : "flex gap-2 opacity-70"}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p>
        <span className="font-medium">{title}</span>
        {!available && <span className="text-muted-foreground"> (tidak tersedia)</span>}
        <br />
        <span className="text-muted-foreground">{text}</span>
      </p>
    </div>
  );
}

function CartRow({
  line,
  quote,
  loading,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  quote?: QuoteLine;
  loading: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  // Harga dan nama terkini dari server; data keranjang dipakai jika belum ada atau alat sudah tidak dijual
  const item = quote?.item ?? line;
  const unavailable = quote?.status === "TIDAK_TERSEDIA";
  const available = quote?.available ?? null;

  return (
    <li className="flex gap-3 p-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
        {item.image ? (
          <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <CategoryIcon slug={item.categorySlug} className="absolute inset-0 m-auto size-8 text-primary/40" />
        )}
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {unavailable ? (
              <p className="font-medium">{item.name}</p>
            ) : (
              <Link href={`/alat/${item.slug}`} className="font-medium hover:underline">
                {item.name}
              </Link>
            )}
            <p className="text-sm text-muted-foreground">{formatRupiah(item.pricePerDay)} / hari</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Hapus ${item.name} dari keranjang`}>
            <Trash2 />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {!unavailable && (
            <div className="flex items-center rounded-lg border" role="group" aria-label={`Jumlah ${item.name}`}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onQuantity(line.quantity - 1)}
                disabled={line.quantity <= 1}
                aria-label="Kurangi jumlah"
              >
                <Minus />
              </Button>
              <output className="w-8 text-center text-sm tabular-nums">{line.quantity}</output>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onQuantity(line.quantity + 1)}
                disabled={available !== null && line.quantity >= available}
                aria-label="Tambah jumlah"
              >
                <Plus />
              </Button>
            </div>
          )}
          {quote && !unavailable && <span className="font-semibold tabular-nums">{formatRupiah(quote.lineTotal)}</span>}
        </div>

        <LineStatus quote={quote} loading={loading} onFix={available ? () => onQuantity(available) : undefined} />
      </div>
    </li>
  );
}

function LineStatus({ quote, loading, onFix }: { quote?: QuoteLine; loading: boolean; onFix?: () => void }) {
  if (!quote) {
    return loading ? <p className="text-xs text-muted-foreground">Mengecek stok...</p> : null;
  }
  switch (quote.status) {
    case "TERSEDIA":
      return (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Tersedia
        </p>
      );
    case "STOK_KURANG":
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-destructive">
          <XCircle className="size-3.5" aria-hidden="true" />
          {quote.available === 0
            ? "Tidak tersedia pada waktu ini. Ubah waktu atau hapus alat ini."
            : `Hanya tersisa ${quote.available} unit pada waktu ini.`}
          {onFix && (
            <button type="button" onClick={onFix} className="font-medium underline underline-offset-2">
              Ubah jadi {quote.available}
            </button>
          )}
        </p>
      );
    case "TIDAK_TERSEDIA":
      return (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <XCircle className="size-3.5" aria-hidden="true" />
          Alat ini sudah tidak disewakan. Hapus dari keranjang.
        </p>
      );
    default:
      return <p className="text-xs text-muted-foreground">Stok dicek setelah waktu sewa valid.</p>;
  }
}

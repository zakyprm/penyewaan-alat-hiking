"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useCart } from "@/lib/cart-store";
import { parseWibLocal, toWibLocal } from "@/lib/datetime-local";
import { isDomainError } from "@/lib/domain/errors";
import { rentalDays } from "@/lib/domain/pricing";
import { MIN_ONLINE_LEAD_MINUTES, validateRentalWindow } from "@/lib/domain/schedule";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";

export interface BookingItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  categorySlug: string;
  pricePerDay: number;
  depositPerUnit: number;
  allowKtp: boolean;
}

interface Props {
  item: BookingItem;
  openHour: number;
  closeHour: number;
  /** Waktu dari URL katalog, format "YYYY-MM-DDTHH:mm" WIB */
  initialStart: string | null;
  initialEnd: string | null;
}

/** Pilih waktu sewa, cek unit tersedia, lalu tambah ke keranjang (Req 3.2–3.4). */
export function BookingPanel(props: Props) {
  // Keranjang dibaca dari localStorage: tunggu sampai di browser supaya tidak ada hydration mismatch
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  return <BookingForm {...props} />;
}

function BookingForm({ item, openHour, closeHour, initialStart, initialEnd }: Props) {
  const router = useRouter();
  const ids = useId();
  const cart = useCart();
  const cartLine = cart.lines.find((l) => l.itemId === item.id);

  const [startInput, setStartInput] = useState(
    () => initialStart ?? (cart.startAt ? toWibLocal(new Date(cart.startAt)) : ""),
  );
  const [endInput, setEndInput] = useState(() => initialEnd ?? (cart.endAt ? toWibLocal(new Date(cart.endAt)) : ""));
  const [quantity, setQuantity] = useState(cartLine?.quantity ?? 1);

  const now = useNow();
  const start = parseWibLocal(startInput);
  const end = parseWibLocal(endInput);

  // Aturan waktu yang sama dengan server (jam operasional, minimal 1 jam dari sekarang)
  let windowError: string | null = null;
  if (start && end) {
    try {
      validateRentalWindow({ startAt: start, endAt: end, now: new Date(now), source: "ONLINE", hours: { openHour, closeHour } });
    } catch (error) {
      windowError = isDomainError(error) ? error.message : "Waktu sewa tidak valid.";
    }
  }
  const windowReady = Boolean(start && end && !windowError);

  const availability = useQuery({
    queryKey: ["availability", item.slug, startInput, endInput],
    queryFn: ({ signal }) =>
      api<{ available: number; rentalDays: number }>(
        `/items/${item.slug}/availability?start=${encodeURIComponent(startInput)}&end=${encodeURIComponent(endInput)}`,
        { signal },
      ),
    enabled: windowReady,
    retry: false,
    staleTime: 15_000,
  });

  const available = windowReady ? availability.data?.available : undefined;
  const days = start && end && end > start ? rentalDays(start, end) : null;
  const effectiveQty = available !== undefined ? Math.min(quantity, Math.max(available, 1)) : quantity;
  const canAdd = windowReady && available !== undefined && available >= effectiveQty && effectiveQty >= 1;
  const minStart = toWibLocal(new Date(now + MIN_ONLINE_LEAD_MINUTES * 60_000));

  function handleAdd() {
    if (!start || !end || !canAdd) return;
    const { windowChanged } = cart.addLine(
      { ...item, itemId: item.id, quantity: effectiveQty },
      { startAt: start.toISOString(), endAt: end.toISOString() },
    );
    toast.success(`${item.name} ditambahkan ke keranjang.`, {
      action: { label: "Lihat keranjang", onClick: () => router.push("/keranjang") },
    });
    if (windowChanged) {
      toast.info("Waktu sewa keranjang ikut diperbarui. Ketersediaan alat lain dicek ulang di keranjang.");
    }
  }

  const hoursText = `${String(openHour).padStart(2, "0")}.00–${String(closeHour).padStart(2, "0")}.00 WIB`;

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Waktu sewa</legend>
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-start`}>Ambil</Label>
          <Input
            id={`${ids}-start`}
            type="datetime-local"
            step={1800}
            min={minStart}
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            aria-describedby={`${ids}-hint`}
            className="bg-card"
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
            onChange={(e) => setEndInput(e.target.value)}
            aria-describedby={`${ids}-hint`}
            className="bg-card"
          />
        </div>
        <p id={`${ids}-hint`} className="text-xs text-muted-foreground sm:col-span-2">
          Jam toko {hoursText}. Pesan paling cepat {MIN_ONLINE_LEAD_MINUTES} menit sebelum waktu ambil.
        </p>
      </fieldset>

      {/* Status ketersediaan, diumumkan ke pembaca layar saat berubah */}
      <div aria-live="polite" className="min-h-6 text-sm">
        {windowError ? (
          <p className="flex items-center gap-2 text-destructive">
            <XCircle className="size-4 shrink-0" aria-hidden="true" />
            {windowError}
          </p>
        ) : !windowReady ? (
          <p className="text-muted-foreground">Pilih waktu ambil dan kembali untuk melihat stok.</p>
        ) : availability.isPending ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Mengecek ketersediaan...
          </p>
        ) : availability.isError ? (
          <p className="flex items-center gap-2 text-destructive">
            <XCircle className="size-4 shrink-0" aria-hidden="true" />
            {availability.error.message}
          </p>
        ) : available === 0 ? (
          <p className="flex items-center gap-2 text-destructive">
            <XCircle className="size-4 shrink-0" aria-hidden="true" />
            Tidak tersedia pada waktu ini. Coba tanggal lain.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Tersedia {available} unit untuk {formatDateTime(start!)} – {formatDateTime(end!)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium" id={`${ids}-qty-label`}>
          Jumlah
        </span>
        <div className="flex items-center rounded-lg border bg-card" role="group" aria-labelledby={`${ids}-qty-label`}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuantity(Math.max(1, effectiveQty - 1))}
            disabled={effectiveQty <= 1}
            aria-label="Kurangi jumlah"
          >
            <Minus />
          </Button>
          <output className="w-10 text-center tabular-nums" aria-live="polite">
            {effectiveQty}
          </output>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuantity(effectiveQty + 1)}
            disabled={available === undefined || effectiveQty >= available}
            aria-label="Tambah jumlah"
          >
            <Plus />
          </Button>
        </div>
      </div>

      {days !== null && !windowError && (
        <dl className="grid gap-1 rounded-lg bg-secondary p-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">
              {formatRupiah(item.pricePerDay)} × {days} hari × {effectiveQty} unit
            </dt>
            <dd className="font-semibold tabular-nums">{formatRupiah(item.pricePerDay * days * effectiveQty)}</dd>
          </div>
          {item.depositPerUnit > 0 && (
            <div className="flex justify-between gap-2 text-muted-foreground">
              <dt>Deposit jika memilih jaminan uang</dt>
              <dd className="tabular-nums">{formatRupiah(item.depositPerUnit * effectiveQty)}</dd>
            </div>
          )}
        </dl>
      )}

      <Button size="lg" onClick={handleAdd} disabled={!canAdd} className="h-11 w-full">
        <ShoppingBag aria-hidden="true" />
        {cartLine ? "Perbarui di Keranjang" : "Tambah ke Keranjang"}
      </Button>
    </div>
  );
}

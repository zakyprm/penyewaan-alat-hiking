"use client";

import { IdCard, Loader2, Minus, Plus, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemThumb } from "@/components/admin/item-thumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, apiFieldErrors, errorMessage } from "@/lib/api-client";
import { toWibLocal } from "@/lib/datetime-local";
import { isDomainError } from "@/lib/domain/errors";
import { guaranteeOptions } from "@/lib/domain/guarantee";
import { quote, rentalDays } from "@/lib/domain/pricing";
import { validateRentalWindow } from "@/lib/domain/schedule";
import type { GuaranteeType, ManualPaymentChannel, PaymentMethod } from "@/lib/domain/types";
import { formatRupiah } from "@/lib/format";
import type { AdminItem } from "@/server/services/items";
import type { ShopSettings } from "@/server/services/settings";
import { CustomerPicker, type WalkInCustomer } from "./customer-picker";
import { ItemPicker } from "./item-picker";

interface Props {
  categories: { id: string; name: string }[];
  settings: ShopSettings;
}

interface Line {
  item: AdminItem;
  quantity: number;
}

const CHANNEL_LABEL: Record<ManualPaymentChannel, string> = { TUNAI: "Tunai", TRANSFER: "Transfer", QRIS: "QRIS" };

export function WalkInForm({ categories, settings }: Props) {
  const ids = useId();
  const router = useRouter();

  const [customer, setCustomer] = useState<WalkInCustomer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [startInput, setStartInput] = useState(() => toWibLocal(new Date()));
  const [endInput, setEndInput] = useState(() => toWibLocal(new Date(Date.now() + 24 * 3600_000)));
  const [guaranteeType, setGuaranteeType] = useState<GuaranteeType>("DEPOSIT");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BAYAR_DI_TOKO");
  const [pickupNow, setPickupNow] = useState(false);
  const [paymentChannel, setPaymentChannel] = useState<ManualPaymentChannel>("TUNAI");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const startAt = useMemo(() => new Date(`${startInput}:00+07:00`), [startInput]);
  const endAt = useMemo(() => new Date(`${endInput}:00+07:00`), [endInput]);

  const windowError = useMemo(() => {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return "Isi waktu ambil dan kembali.";
    try {
      validateRentalWindow({ startAt, endAt, now: new Date(), source: "WALK_IN", hours: settings });
      return null;
    } catch (e) {
      return isDomainError(e) ? e.message : "Waktu sewa tidak valid.";
    }
  }, [startAt, endAt, settings]);

  const days = !windowError ? rentalDays(startAt, endAt) : 0;
  const priced = !windowError && lines.length > 0 ? quote(lines.map((l) => ({ ...l.item, quantity: l.quantity })), days, guaranteeType) : null;
  const options = guaranteeOptions(lines.map((l) => l.item), settings);
  const selectedOption = options.find((o) => o.type === guaranteeType);

  function addItem(item: AdminItem) {
    setLines((prev) => (prev.some((l) => l.item.id === item.id) ? prev : [...prev, { item, quantity: 1 }]));
  }
  function setQuantity(itemId: string, quantity: number) {
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, quantity: Math.max(1, Math.min(quantity, l.item.stock)) } : l)));
  }
  function removeItem(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item.id !== itemId));
  }

  const canSubmit =
    customer !== null &&
    lines.length > 0 &&
    !windowError &&
    selectedOption?.available &&
    (!pickupNow || paymentMethod === "BAYAR_DI_TOKO");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const order = await api<{ id: string; code: string }>("/admin/orders/walk-in", {
        json: {
          customer,
          items: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          guaranteeType,
          paymentMethod,
          note: note || undefined,
          pickupNow,
          paymentChannel: pickupNow ? paymentChannel : undefined,
        },
      });
      toast.success(`Pesanan ${order.code} dibuat.`);
      router.push(`/admin/pesanan/${order.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "STOK_TIDAK_CUKUP") {
        setError(err.message);
        return;
      }
      const fields = apiFieldErrors(err);
      if (fields.length === 0) setError(errorMessage(err));
      const map: Record<string, string> = {};
      for (const f of fields) map[f.path] = f.message;
      setFieldErrors(map);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6">
      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Pelanggan</legend>
        <CustomerPicker
          value={customer}
          onChange={setCustomer}
          errors={{ name: fieldErrors["customer.name"], phone: fieldErrors["customer.phone"] }}
        />
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Alat</legend>
        <ItemPicker categories={categories} onAdd={addItem} excludeIds={lines.map((l) => l.item.id)} />

        {lines.length > 0 && (
          <ul className="mt-2 grid gap-2">
            {lines.map(({ item, quantity }) => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
                <ItemThumb src={item.images[0]} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRupiah(item.pricePerDay)}/hari · stok {item.stock}
                  </p>
                </div>
                <div className="flex items-center rounded-lg border">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQuantity(item.id, quantity - 1)} disabled={quantity <= 1} aria-label={`Kurangi ${item.name}`}>
                    <Minus />
                  </Button>
                  <output className="w-8 text-center text-sm tabular-nums">{quantity}</output>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQuantity(item.id, quantity + 1)} disabled={quantity >= item.stock} aria-label={`Tambah ${item.name}`}>
                    <Plus />
                  </Button>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(item.id)} aria-label={`Hapus ${item.name}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Waktu sewa</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-start`}>Ambil</Label>
            <Input id={`${ids}-start`} type="datetime-local" step={1800} value={startInput} onChange={(e) => setStartInput(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-end`}>Kembali</Label>
            <Input id={`${ids}-end`} type="datetime-local" step={1800} value={endInput} onChange={(e) => setEndInput(e.target.value)} />
          </div>
        </div>
        {windowError && <p className="text-sm text-destructive">{windowError}</p>}
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Jaminan</legend>
        <RadioGroup value={guaranteeType} onValueChange={(v) => setGuaranteeType(v as GuaranteeType)} className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <Label
              key={o.type}
              htmlFor={`${ids}-g-${o.type}`}
              aria-disabled={!o.available}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              <RadioGroupItem id={`${ids}-g-${o.type}`} value={o.type} disabled={!o.available} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-1.5 font-medium">
                  {o.type === "DEPOSIT" ? <Wallet className="size-4" aria-hidden="true" /> : <IdCard className="size-4" aria-hidden="true" />}
                  {o.type === "DEPOSIT" ? "Deposit uang" : "KTP asli"}
                </span>
                {!o.available && <span className="text-xs text-muted-foreground">{o.reason}</span>}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Pembayaran</legend>
        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid gap-2 sm:grid-cols-2">
          <Label htmlFor={`${ids}-m-toko`} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary">
            <RadioGroupItem id={`${ids}-m-toko`} value="BAYAR_DI_TOKO" />
            Bayar di toko
          </Label>
          <Label htmlFor={`${ids}-m-online`} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary">
            <RadioGroupItem id={`${ids}-m-online`} value="ONLINE" />
            Bayar online (kirim tautan)
          </Label>
        </RadioGroup>

        {paymentMethod === "BAYAR_DI_TOKO" && (
          <div className="grid gap-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <Checkbox id={`${ids}-pickup-now`} checked={pickupNow} onCheckedChange={(c) => setPickupNow(c === true)} />
              <Label htmlFor={`${ids}-pickup-now`} className="font-normal">
                Alat langsung dibawa sekarang (catat lunas, jaminan diterima, dan diambil)
              </Label>
            </div>
            {pickupNow && (
              <div className="grid gap-1.5 sm:w-64">
                <Label htmlFor={`${ids}-channel`}>Cara bayar</Label>
                <Select value={paymentChannel} onValueChange={(v) => setPaymentChannel(v as ManualPaymentChannel)}>
                  <SelectTrigger id={`${ids}-channel`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["TUNAI", "TRANSFER", "QRIS"] as const).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CHANNEL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-note`}>Catatan (opsional)</Label>
        <Textarea id={`${ids}-note`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {priced && (
        <div className="grid gap-1 rounded-xl bg-secondary p-4 text-sm">
          <div className="flex justify-between">
            <span>Biaya sewa ({days} hari)</span>
            <span className="font-semibold tabular-nums">{formatRupiah(priced.rentalSubtotal)}</span>
          </div>
          {priced.depositTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Deposit</span>
              <span className="tabular-nums">{formatRupiah(priced.depositTotal)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(priced.totalDue)}</span>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={!canSubmit || submitting} className="h-11 w-full">
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        <ShoppingBag aria-hidden="true" />
        Buat Pesanan
      </Button>
    </form>
  );
}

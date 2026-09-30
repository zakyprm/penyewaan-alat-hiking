"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { IdCard, Loader2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { useCart } from "@/lib/cart-store";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { openSnapPayment } from "@/lib/midtrans-snap";
import { useHydrated } from "@/lib/use-hydrated";
import { checkoutFormSchema, type CheckoutFormValues } from "@/lib/validation/checkout-form";
import type { CartQuote } from "@/server/services/cart";
import type { CreatedOrder } from "@/server/services/orders";

interface Props {
  defaultName: string;
  defaultPhone: string;
  midtransEnabled: boolean;
}

export function CheckoutForm(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-96 w-full rounded-xl" aria-busy="true" />;
  return <CheckoutFormReady {...props} />;
}

function CheckoutFormReady({ defaultName, defaultPhone, midtransEnabled }: Props) {
  const ids = useId();
  const router = useRouter();
  const cart = useCart();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const payload =
    cart.startAt && cart.endAt
      ? { items: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })), startAt: cart.startAt, endAt: cart.endAt }
      : null;
  const quote = useQuery({
    queryKey: ["quote", payload],
    queryFn: ({ signal }) => api<CartQuote>("/quote", { json: payload, signal }),
    enabled: payload !== null,
    retry: false,
  });
  const data = quote.data;
  const deposit = data?.guaranteeOptions.find((o) => o.type === "DEPOSIT");
  const ktp = data?.guaranteeOptions.find((o) => o.type === "KTP");
  const defaultGuarantee = deposit?.available ? "DEPOSIT" : ktp?.available ? "KTP" : "DEPOSIT";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { customerName: defaultName, customerPhone: defaultPhone, guaranteeType: "DEPOSIT", paymentMethod: "BAYAR_DI_TOKO", note: "" },
  });

  // Set setelah quote datang, supaya tidak "melompat" dari opsi yang belum tentu tersedia
  useEffect(() => {
    if (data) setValue("guaranteeType", defaultGuarantee);
  }, [data, defaultGuarantee, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (!payload || !data?.canCheckout) return;
    setSubmitError(null);
    try {
      const result = await api<{ order: CreatedOrder; payment: { snapToken: string; clientKey: string; snapUrl: string } | null }>(
        "/orders",
        { json: { ...payload, ...values, note: values.note || undefined } },
      );

      if (values.paymentMethod === "ONLINE" && result.payment) {
        setRedirecting(true);
        await openSnapPayment(result.payment, {
          onSuccess: () => {
            cart.clear();
            router.push(`/pesanan/${result.order.code}`);
          },
          onPending: () => {
            cart.clear();
            router.push(`/pesanan/${result.order.code}`);
          },
          onError: () => {
            setRedirecting(false);
            toast.error("Pembayaran gagal. Pesanan tetap tersimpan, kamu bisa membayar lagi dari halaman pesanan.");
            cart.clear();
            router.push(`/pesanan/${result.order.code}`);
          },
          onClose: () => {
            setRedirecting(false);
            toast.info("Pembayaran belum diselesaikan. Pesanan tersimpan, bayar lagi dari halaman pesanan sebelum kedaluwarsa.");
            cart.clear();
            router.push(`/pesanan/${result.order.code}`);
          },
        });
        return;
      }

      cart.clear();
      toast.success("Pesanan berhasil dibuat.");
      router.push(`/pesanan/${result.order.code}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "STOK_TIDAK_CUKUP") {
        toast.error(error.message);
        await quote.refetch();
        return;
      }
      setSubmitError(errorMessage(error));
    }
  });

  if (!payload) return null;
  if (quote.isError) {
    return (
      <p className="rounded-lg bg-danger-muted px-4 py-3 text-sm text-destructive">
        {errorMessage(quote.error)}{" "}
        <button type="button" onClick={() => quote.refetch()} className="font-medium underline">
          Coba lagi
        </button>
      </p>
    );
  }
  if (!data) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!data.canCheckout) {
    return (
      <p className="rounded-lg bg-warning-muted px-4 py-3 text-sm text-warning">
        Ada alat yang tidak lagi tersedia untuk waktu ini.{" "}
        <a href="/keranjang" className="font-medium underline">
          Kembali ke keranjang
        </a>{" "}
        untuk menyesuaikan.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Data penyewa</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id={`${ids}-name`} label="Nama lengkap" error={errors.customerName?.message} {...register("customerName")} />
          <FormField
            id={`${ids}-phone`}
            label="Nomor HP (WhatsApp)"
            type="tel"
            placeholder="081234567890"
            error={errors.customerPhone?.message}
            {...register("customerPhone")}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Jaminan</legend>
        <p className="text-sm text-muted-foreground">Total deposit: {formatRupiah(data.depositTotal)}, dikembalikan setelah alat kembali.</p>
        <Controller
          control={control}
          name="guaranteeType"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
              <GuaranteeOption
                id={`${ids}-g-deposit`}
                value="DEPOSIT"
                icon={Wallet}
                title="Deposit uang"
                desc={`${formatRupiah(data.depositTotal)}, dikembalikan penuh jika tepat waktu`}
                disabled={!deposit?.available}
                reason={deposit?.reason}
              />
              <GuaranteeOption
                id={`${ids}-g-ktp`}
                value="KTP"
                icon={IdCard}
                title="KTP asli"
                desc="Tanpa biaya tambahan, dititipkan saat ambil alat"
                disabled={!ktp?.available}
                reason={ktp?.reason}
              />
            </RadioGroup>
          )}
        />
        {errors.guaranteeType && <p className="text-sm text-destructive">{errors.guaranteeType.message}</p>}
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <legend className="mb-1 font-semibold">Metode pembayaran</legend>
        <Controller
          control={control}
          name="paymentMethod"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
              <Label htmlFor={`${ids}-m-toko`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary">
                <RadioGroupItem id={`${ids}-m-toko`} value="BAYAR_DI_TOKO" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Bayar di toko</span>
                  <span className="text-xs text-muted-foreground">Bayar tunai/transfer/QRIS saat mengambil alat</span>
                </span>
              </Label>
              <Label
                htmlFor={`${ids}-m-online`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                aria-disabled={!midtransEnabled}
              >
                <RadioGroupItem id={`${ids}-m-online`} value="ONLINE" disabled={!midtransEnabled} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Bayar online</span>
                  <span className="text-xs text-muted-foreground">
                    {midtransEnabled ? "Kartu, VA, e-wallet, atau QRIS lewat Midtrans" : "Belum tersedia"}
                  </span>
                </span>
              </Label>
            </RadioGroup>
          )}
        />
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-note`}>Catatan untuk toko (opsional)</Label>
        <Textarea id={`${ids}-note`} rows={2} {...register("note")} />
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <Button size="lg" type="submit" disabled={isSubmitting || redirecting} className="h-11 w-full">
        {(isSubmitting || redirecting) && <Loader2 className="animate-spin" aria-hidden="true" />}
        {redirecting ? "Membuka pembayaran..." : "Buat Pesanan"}
      </Button>
    </form>
  );
}

function GuaranteeOption({
  id,
  value,
  icon: Icon,
  title,
  desc,
  disabled,
  reason,
}: {
  id: string;
  value: "DEPOSIT" | "KTP";
  icon: typeof Wallet;
  title: string;
  desc: string;
  disabled?: boolean;
  reason?: string;
}) {
  return (
    <Label
      htmlFor={id}
      aria-disabled={disabled}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      <span className="grid gap-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{disabled ? reason : desc}</span>
      </span>
    </Label>
  );
}

export function CheckoutSummary() {
  const hydrated = useHydrated();
  const cart = useCart();
  if (!hydrated) return <Skeleton className="h-48 w-full rounded-xl" aria-busy="true" />;
  if (cart.lines.length === 0) return null;

  return (
    <aside aria-labelledby="ringkasan-checkout" className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 id="ringkasan-checkout" className="font-semibold">
        Alat yang disewa
      </h2>
      {cart.startAt && cart.endAt && (
        <p className="text-sm text-muted-foreground">
          {formatDateTime(cart.startAt)} – {formatDateTime(cart.endAt)}
        </p>
      )}
      <ul className="grid gap-1 text-sm">
        {cart.lines.map((l) => (
          <li key={l.itemId} className="flex justify-between gap-2">
            <span className="text-muted-foreground">
              {l.name} × {l.quantity}
            </span>
            <span>{formatRupiah(l.pricePerDay * l.quantity)} / hari</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

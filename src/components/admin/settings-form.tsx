"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api, apiFieldErrors, errorMessage } from "@/lib/api-client";
import { settingsSchema, type SettingsInput } from "@/lib/validation/settings";
import type { ShopSettings } from "@/server/services/settings";

/** Form pengaturan toko (Req 17). Selalu mengirim seluruh field lewat PATCH. */
export function SettingsForm({ settings }: { settings: ShopSettings }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema), defaultValues: settings });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api("/admin/settings", { method: "PATCH", json: values });
      toast.success("Pengaturan disimpan.");
      router.refresh();
    } catch (error) {
      const fields = apiFieldErrors(error);
      if (fields.length === 0) toast.error(errorMessage(error));
      for (const f of fields) setError(f.path as keyof SettingsInput, { message: f.message });
      if (fields.length === 0 && error instanceof Error) toast.error(error.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Keterlambatan &amp; denda</CardTitle>
          <CardDescription>Berlaku untuk pesanan baru. Pesanan yang sudah dibuat memakai kebijakan saat dibuat.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="graceHours"
            label="Grace period (jam)"
            type="number"
            inputMode="numeric"
            min={0}
            max={72}
            hint="Toleransi sebelum denda telat mulai dihitung."
            error={errors.graceHours?.message}
            {...register("graceHours", { valueAsNumber: true })}
          />
          <FormField
            id="lateFinePercent"
            label="Persentase denda telat (%)"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            hint="Dari harga sewa per hari, per hari telat."
            error={errors.lateFinePercent?.message}
            {...register("lateFinePercent", { valueAsNumber: true })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jaminan</CardTitle>
          <CardDescription>Minimal satu jenis jaminan harus aktif.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Controller
            control={control}
            name="depositEnabled"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox id="depositEnabled" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                <Label htmlFor="depositEnabled" className="font-normal">
                  Jaminan deposit uang aktif
                </Label>
              </div>
            )}
          />
          <Controller
            control={control}
            name="ktpEnabled"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox id="ktpEnabled" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                <Label htmlFor="ktpEnabled" className="font-normal">
                  Jaminan KTP aktif
                </Label>
              </div>
            )}
          />
          {(errors.depositEnabled ?? errors.ktpEnabled) && (
            <p className="text-sm text-destructive">{errors.depositEnabled?.message ?? errors.ktpEnabled?.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batas waktu pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="onlinePaymentExpiryMin"
            label="Batas bayar online (menit)"
            type="number"
            inputMode="numeric"
            min={15}
            max={1440}
            hint="Pesanan online dibatalkan otomatis jika belum dibayar."
            error={errors.onlinePaymentExpiryMin?.message}
            {...register("onlinePaymentExpiryMin", { valueAsNumber: true })}
          />
          <FormField
            id="payAtStoreCancelHours"
            label="Batas bayar di toko (jam sebelum ambil)"
            type="number"
            inputMode="numeric"
            min={0}
            max={168}
            hint="Pesanan bayar-di-toko dibatalkan jika belum dibayar sampai batas ini."
            error={errors.payAtStoreCancelHours?.message}
            {...register("payAtStoreCancelHours", { valueAsNumber: true })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jam operasional</CardTitle>
          <CardDescription>Waktu ambil dan kembali pelanggan harus berada dalam rentang ini (WIB).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="openHour"
            label="Jam buka"
            type="number"
            inputMode="numeric"
            min={0}
            max={23}
            error={errors.openHour?.message}
            {...register("openHour", { valueAsNumber: true })}
          />
          <FormField
            id="closeHour"
            label="Jam tutup"
            type="number"
            inputMode="numeric"
            min={1}
            max={24}
            error={errors.closeHour?.message}
            {...register("closeHour", { valueAsNumber: true })}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}

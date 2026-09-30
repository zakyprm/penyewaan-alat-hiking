"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiFieldErrors, errorMessage } from "@/lib/api-client";
import { MANUAL_PAYMENT_CHANNELS, PAYMENT_PURPOSES, type ManualPaymentChannel, type PaymentPurpose } from "@/lib/domain/types";
import { recordPaymentSchema, type RecordPaymentInput } from "@/lib/validation/order";

const PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  SEWA_DAN_DEPOSIT: "Sewa + Deposit",
  DENDA: "Denda",
  REFUND_DEPOSIT: "Pengembalian Sisa Deposit",
};
const CHANNEL_LABEL: Record<ManualPaymentChannel, string> = { TUNAI: "Tunai", TRANSFER: "Transfer", QRIS: "QRIS" };

const formSchema = recordPaymentSchema.extend({ amount: z.coerce.number() as unknown as typeof recordPaymentSchema.shape.amount });

/** Dialog catat pembayaran manual (Req 8.8, 11.4). */
export function PaymentForm({ orderId, defaultPurpose }: { orderId: string; defaultPurpose?: PaymentPurpose }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { purpose: defaultPurpose ?? "SEWA_DAN_DEPOSIT", channel: "TUNAI", amount: 0, note: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api(`/admin/orders/${orderId}/payments`, { json: { ...values, note: values.note || undefined } });
      toast.success("Pembayaran dicatat.");
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      const fields = apiFieldErrors(error);
      if (fields.length === 0) toast.error(errorMessage(error));
      for (const f of fields) setError(f.path as keyof RecordPaymentInput, { message: f.message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden="true" />
          Catat Pembayaran
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Catat pembayaran</DialogTitle>
            <DialogDescription>Untuk pembayaran tunai, transfer, atau QRIS yang diterima langsung.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="purpose">Jenis</Label>
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="purpose" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PURPOSE_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="channel">Cara bayar</Label>
            <Controller
              control={control}
              name="channel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="channel" className="w-full" aria-invalid={errors.channel ? true : undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_PAYMENT_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CHANNEL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <FormField id="amount" label="Nominal (Rp)" type="number" inputMode="numeric" min={1} step={1000} error={errors.amount?.message} {...register("amount", { valueAsNumber: true })} />
          <FormField id="note" label="Catatan (opsional)" error={errors.note?.message} {...register("note")} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

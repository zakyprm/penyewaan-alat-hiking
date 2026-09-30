"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { z } from "zod";
import { quickItemSchema, type QuickItemInput } from "@/lib/validation/catalog";
import type { AdminItem } from "@/server/services/items";

interface Props {
  categories: { id: string; name: string }[];
  onCreated: (item: AdminItem) => void;
}

/** Dialog "Tambah alat cepat" (Req 13.4): alat baru langsung dibuat sebagai INTERNAL. */
export function QuickItemDialog({ categories, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof quickItemSchema>, unknown, QuickItemInput>({
    resolver: zodResolver(quickItemSchema),
    defaultValues: { name: "", categoryId: categories[0]?.id ?? "", pricePerDay: 0, depositPerUnit: 0, stock: 1, allowKtp: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const item = await api<AdminItem>("/admin/items/quick", { json: values });
      toast.success(`${item.name} ditambahkan (alat internal).`);
      onCreated(item);
      setOpen(false);
      reset();
    } catch (error) {
      const fields = apiFieldErrors(error);
      if (fields.length === 0) toast.error(errorMessage(error));
      for (const f of fields) setError(f.path as keyof QuickItemInput, { message: f.message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Plus aria-hidden="true" />
          Tambah alat cepat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Tambah alat cepat</DialogTitle>
            <DialogDescription>
              Untuk alat yang belum ada di katalog. Alat ini otomatis tersimpan sebagai <strong>internal</strong> (tidak
              tampil di katalog online), dan bisa diubah jadi publik nanti dari halaman Alat.
            </DialogDescription>
          </DialogHeader>

          <FormField id="qi-name" label="Nama alat" error={errors.name?.message} {...register("name")} />

          <div className="grid gap-1.5">
            <Label htmlFor="qi-category">Kategori</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="qi-category" className="w-full" aria-invalid={errors.categoryId ? true : undefined}>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              id="qi-price"
              label="Harga/hari"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              error={errors.pricePerDay?.message}
              {...register("pricePerDay", { valueAsNumber: true })}
            />
            <FormField
              id="qi-deposit"
              label="Deposit"
              type="number"
              inputMode="numeric"
              min={0}
              step={5000}
              error={errors.depositPerUnit?.message}
              {...register("depositPerUnit", { valueAsNumber: true })}
            />
            <FormField
              id="qi-stock"
              label="Stok"
              type="number"
              inputMode="numeric"
              min={1}
              error={errors.stock?.message}
              {...register("stock", { valueAsNumber: true })}
            />
          </div>

          <Controller
            control={control}
            name="allowKtp"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox id="qi-ktp" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                <Label htmlFor="qi-ktp" className="font-normal">
                  Izinkan jaminan KTP
                </Label>
              </div>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Tambah
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

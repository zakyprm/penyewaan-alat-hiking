"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, type Control, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, apiFieldErrors, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import {
  itemFormSchema,
  itemFormToPayload,
  MAX_ITEM_IMAGES,
  type ItemFormValues,
} from "@/lib/validation/catalog";
import type { AdminItem, AffectedOrder } from "@/server/services/items";
import { ConfirmDialog } from "./confirm-dialog";
import { ImageUploader } from "./image-uploader";

interface Props {
  item?: AdminItem;
  categories: { id: string; name: string }[];
}

interface StockWarning {
  message: string;
  affected: AffectedOrder[];
  payload: ReturnType<typeof itemFormToPayload>;
}

function defaults(item?: AdminItem): ItemFormValues {
  return {
    name: item?.name ?? "",
    categoryId: item?.categoryId ?? "",
    description: item?.description ?? "",
    specs: item?.specs ? Object.entries(item.specs).map(([key, value]) => ({ key, value })) : [{ key: "", value: "" }],
    pricePerDay: item?.pricePerDay ?? 0,
    depositPerUnit: item?.depositPerUnit ?? 0,
    stock: item?.stock ?? 1,
    visibility: item?.visibility ?? "PUBLIC",
    allowKtp: item?.allowKtp ?? true,
    isActive: item?.isActive ?? true,
    images: item?.images ?? [],
  };
}

export function ItemForm({ item, categories }: Props) {
  const router = useRouter();
  const [stockWarning, setStockWarning] = useState<StockWarning | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema), defaultValues: defaults(item) });
  const specs = useFieldArray({ control, name: "specs" });

  async function save(payload: ReturnType<typeof itemFormToPayload>, confirmStock = false) {
    try {
      if (item) {
        await api(`/admin/items/${item.id}${confirmStock ? "?konfirmasiStok=1" : ""}`, { method: "PATCH", json: payload });
        toast.success("Perubahan alat disimpan.");
      } else {
        await api("/admin/items", { json: payload });
        toast.success(`${payload.name} ditambahkan.`);
      }
      router.push("/admin/alat");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "STOK_DI_BAWAH_PESANAN") {
        const details = error.details as { affected: AffectedOrder[] };
        setStockWarning({ message: error.message, affected: details.affected, payload });
        return;
      }
      const fields = apiFieldErrors(error);
      if (fields.length === 0) toast.error(errorMessage(error));
      for (const f of fields) setError(f.path as FieldPath<ItemFormValues>, { message: f.message });
    }
  }

  const onSubmit = handleSubmit((values) => save(itemFormToPayload(values)));
  const specsError = errors.specs?.root?.message ?? errors.specs?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Informasi alat</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField id="name" label="Nama alat" error={errors.name?.message} {...register("name")} />

          <div className="grid gap-1.5">
            <Label htmlFor="categoryId">Kategori</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="categoryId"
                    className="w-full sm:w-72"
                    aria-invalid={errors.categoryId ? true : undefined}
                    aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
                  >
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
            {errors.categoryId && (
              <p id="categoryId-error" className="text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea
              id="description"
              rows={4}
              aria-invalid={errors.description ? true : undefined}
              {...register("description")}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Harga dan stok</CardTitle>
          <CardDescription>Nominal dalam Rupiah, tanpa titik.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="pricePerDay"
            label="Harga sewa per hari"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            error={errors.pricePerDay?.message}
            {...register("pricePerDay", { valueAsNumber: true })}
          />
          <FormField
            id="depositPerUnit"
            label="Deposit per unit"
            type="number"
            inputMode="numeric"
            min={0}
            step={5000}
            hint="Dipakai jika pelanggan memilih jaminan deposit."
            error={errors.depositPerUnit?.message}
            {...register("depositPerUnit", { valueAsNumber: true })}
          />
          <FormField
            id="stock"
            label="Stok total (unit)"
            type="number"
            inputMode="numeric"
            min={0}
            error={errors.stock?.message}
            {...register("stock", { valueAsNumber: true })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibilitas dan jaminan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Tampil di mana?</legend>
            <Controller
              control={control}
              name="visibility"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: "PUBLIC", title: "Publik", desc: "Tampil di katalog dan bisa dipesan online." },
                    { value: "INTERNAL", title: "Internal", desc: "Tidak tampil di katalog. Hanya untuk sewa di toko." },
                  ].map((opt) => (
                    <Label
                      key={opt.value}
                      htmlFor={`visibility-${opt.value}`}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary"
                    >
                      <RadioGroupItem id={`visibility-${opt.value}`} value={opt.value} className="mt-0.5" />
                      <span className="grid gap-0.5">
                        <span className="font-medium">{opt.title}</span>
                        <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              )}
            />
          </fieldset>

          <CheckboxRow
            control={control}
            name="allowKtp"
            label="Izinkan jaminan KTP"
            description="Matikan untuk alat bernilai tinggi supaya hanya bisa dijamin dengan deposit."
          />
          <CheckboxRow
            control={control}
            name="isActive"
            label="Aktif"
            description="Alat nonaktif tidak bisa disewa, tapi riwayatnya tetap tersimpan."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spesifikasi</CardTitle>
          <CardDescription>Contoh: Kapasitas — 2 orang, Berat — 2,2 kg.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {specs.fields.map((field, i) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <label htmlFor={`spec-key-${i}`} className="sr-only">
                  Nama spesifikasi {i + 1}
                </label>
                <Input id={`spec-key-${i}`} placeholder="Nama, misal Berat" {...register(`specs.${i}.key`)} />
                <label htmlFor={`spec-value-${i}`} className="sr-only">
                  Isi spesifikasi {i + 1}
                </label>
                <Input id={`spec-value-${i}`} placeholder="Isi, misal 2,2 kg" {...register(`specs.${i}.value`)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => specs.remove(i)}
                aria-label={`Hapus spesifikasi ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {specsError && <p className="text-sm text-destructive">{specsError}</p>}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => specs.append({ key: "", value: "" })}
            disabled={specs.fields.length >= 20}
          >
            <Plus aria-hidden="true" />
            Tambah spesifikasi
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Foto</CardTitle>
          <CardDescription>Foto pertama menjadi foto utama di katalog.</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="images"
            render={({ field }) => (
              <ImageUploader
                value={field.value}
                onChange={field.onChange}
                max={MAX_ITEM_IMAGES}
                error={errors.images?.message}
              />
            )}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/alat">Batal</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {item ? "Simpan Perubahan" : "Tambah Alat"}
        </Button>
      </div>

      <ConfirmDialog
        open={stockWarning !== null}
        onOpenChange={(open) => !open && setStockWarning(null)}
        title="Stok lebih kecil dari pesanan"
        description={`${stockWarning?.message ?? ""} Pesanan berikut terdampak. Hubungi pelanggan atau sesuaikan pesanan jika tetap menurunkan stok.`}
        confirmLabel="Tetap simpan"
        destructive
        onConfirm={async () => {
          if (stockWarning) await save(stockWarning.payload, true);
        }}
      >
        <ul className="grid max-h-60 gap-2 overflow-y-auto text-sm">
          {stockWarning?.affected.map((o) => (
            <li key={o.orderId} className="rounded-lg border p-2">
              <p className="font-medium">
                {o.code} · {o.customerName} · {o.quantity} unit
              </p>
              <p className="text-muted-foreground">
                {formatDateTime(o.startAt)} – {formatDateTime(o.endAt)}
              </p>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </form>
  );
}

function CheckboxRow({
  control,
  name,
  label,
  description,
}: {
  control: Control<ItemFormValues>;
  name: "allowKtp" | "isActive";
  label: string;
  description: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start gap-3">
          <Checkbox
            id={name}
            checked={field.value}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            aria-describedby={`${name}-desc`}
            className="mt-0.5"
          />
          <div className="grid gap-0.5">
            <Label htmlFor={name}>{label}</Label>
            <p id={`${name}-desc`} className="text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      )}
    />
  );
}

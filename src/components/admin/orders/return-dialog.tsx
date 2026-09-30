"use client";

import { AlertTriangle, Loader2, PackageOpen, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api-client";
import { toWibLocal } from "@/lib/datetime-local";
import { lateFine } from "@/lib/domain/fine";
import { MANUAL_CHARGE_TYPES, type ManualChargeType } from "@/lib/domain/types";
import { formatRupiah } from "@/lib/format";
import type { AdminOrderDetail } from "@/server/services/admin-orders";

const CHARGE_TYPE_LABEL: Record<ManualChargeType, string> = { KERUSAKAN: "Kerusakan", KEHILANGAN: "Kehilangan" };

interface ChargeRow {
  key: number;
  /** OrderItem.id (baris pesanan), bukan Item.id */
  orderItemId: string;
  type: ManualChargeType;
  amount: string;
  note: string;
}

/** Dialog "Catat Pengembalian" (Req 11.1–11.3): waktu kembali, pratinjau denda telat, denda manual per alat. */
export function ReturnDialog({ order }: { order: AdminOrderDetail }) {
  const ids = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [returnedAtInput, setReturnedAtInput] = useState(() => toWibLocal(new Date()));
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnedAt = new Date(`${returnedAtInput}:00+07:00`);
  const preview = useMemo(() => {
    if (Number.isNaN(returnedAt.getTime())) return null;
    return lateFine({
      endAt: order.endAt,
      returnedAt,
      graceHours: order.graceHours,
      lateFinePercent: order.lateFinePercent,
      lines: order.items,
    });
  }, [returnedAtInput, order]); // eslint-disable-line react-hooks/exhaustive-deps

  function addCharge() {
    setCharges((prev) => [...prev, { key: Date.now(), orderItemId: order.items[0]?.id ?? "", type: "KERUSAKAN", amount: "", note: "" }]);
  }
  function updateCharge(key: number, patch: Partial<ChargeRow>) {
    setCharges((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function removeCharge(key: number) {
    setCharges((prev) => prev.filter((c) => c.key !== key));
  }

  const manualTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const chargesValid = charges.every((c) => c.orderItemId && Number(c.amount) > 0 && c.note.trim().length >= 3);

  async function handleSubmit() {
    if (!chargesValid) {
      setError("Lengkapi alat, nominal (> 0), dan catatan (min. 3 karakter) untuk setiap denda.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api(`/admin/orders/${order.id}/return`, {
        json: {
          returnedAt: returnedAt.toISOString(),
          charges: charges.map((c) => ({ type: c.type, orderItemId: c.orderItemId, amount: Number(c.amount), note: c.note.trim() })),
        },
      });
      toast.success("Pengembalian tercatat.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PackageOpen aria-hidden="true" />
          Catat Pengembalian
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat pengembalian alat</DialogTitle>
          <DialogDescription>Denda keterlambatan dihitung otomatis. Tambahkan denda kerusakan/kehilangan jika ada.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-returnedAt`}>Waktu dikembalikan</Label>
            <Input
              id={`${ids}-returnedAt`}
              type="datetime-local"
              step={60}
              value={returnedAtInput}
              onChange={(e) => setReturnedAtInput(e.target.value)}
            />
          </div>

          {preview && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${preview.amount > 0 ? "bg-warning-muted text-warning" : "bg-success-muted text-success"}`}
              aria-live="polite"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {preview.amount > 0
                ? `Terlambat ${preview.lateDays} hari. Denda keterlambatan: ${formatRupiah(preview.amount)}.`
                : "Dalam batas waktu, tidak ada denda keterlambatan."}
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Denda kerusakan / kehilangan (opsional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCharge}>
                <Plus aria-hidden="true" />
                Tambah
              </Button>
            </div>

            {charges.map((c) => (
              <div key={c.key} className="grid gap-2 rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor={`${ids}-item-${c.key}`} className="text-xs font-normal text-muted-foreground">
                      Alat
                    </Label>
                    <Select value={c.orderItemId} onValueChange={(v) => updateCharge(c.key, { orderItemId: v })}>
                      <SelectTrigger id={`${ids}-item-${c.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {order.items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.itemName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`${ids}-type-${c.key}`} className="text-xs font-normal text-muted-foreground">
                      Jenis
                    </Label>
                    <Select value={c.type} onValueChange={(v) => updateCharge(c.key, { type: v as ManualChargeType })}>
                      <SelectTrigger id={`${ids}-type-${c.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_CHARGE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {CHARGE_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor={`${ids}-amount-${c.key}`} className="text-xs font-normal text-muted-foreground">
                      Nominal (Rp)
                    </Label>
                    <Input
                      id={`${ids}-amount-${c.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1000}
                      value={c.amount}
                      onChange={(e) => updateCharge(c.key, { amount: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => removeCharge(c.key)} aria-label="Hapus denda ini">
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${ids}-note-${c.key}`} className="text-xs font-normal text-muted-foreground">
                    Catatan
                  </Label>
                  <Input id={`${ids}-note-${c.key}`} placeholder="Jelaskan kerusakan/kehilangan" value={c.note} onChange={(e) => updateCharge(c.key, { note: e.target.value })} />
                </div>
              </div>
            ))}
          </div>

          {(preview?.amount ?? 0) + manualTotal > 0 && (
            <p className="text-sm font-medium">Total denda: {formatRupiah((preview?.amount ?? 0) + manualTotal)}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Catat Pengembalian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


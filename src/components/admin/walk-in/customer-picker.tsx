"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, User, UserPlus, X } from "lucide-react";
import { useId, useState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/lib/api-client";
import type { CustomerOption } from "@/server/services/customers";

export type WalkInCustomer = { type: "REGISTERED"; userId: string; name: string } | { type: "GUEST"; name: string; phone: string };

interface Props {
  value: WalkInCustomer | null;
  onChange: (customer: WalkInCustomer | null) => void;
  errors?: { name?: string; phone?: string };
}

/** Pilih pelanggan terdaftar (cari) atau isi data tamu (Req 13.2). */
export function CustomerPicker({ value, onChange, errors }: Props) {
  const ids = useId();
  const [mode, setMode] = useState<"REGISTERED" | "GUEST">(value?.type ?? "REGISTERED");
  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState(value?.type === "GUEST" ? value.name : "");
  const [guestPhone, setGuestPhone] = useState(value?.type === "GUEST" ? value.phone : "");

  const search = useQuery({
    queryKey: ["admin-customers", query],
    queryFn: ({ signal }) => api<CustomerOption[]>(`/admin/customers?q=${encodeURIComponent(query)}`, { signal }),
    enabled: mode === "REGISTERED" && query.trim().length >= 2,
    staleTime: 15_000,
  });

  function selectRegistered(customer: CustomerOption) {
    onChange({ type: "REGISTERED", userId: customer.id, name: customer.name });
    setQuery("");
  }

  function selectMode(next: "REGISTERED" | "GUEST") {
    setMode(next);
    onChange(null);
    setQuery("");
    setGuestName("");
    setGuestPhone("");
  }

  return (
    <div className="grid gap-3">
      <RadioGroup value={mode} onValueChange={(v) => selectMode(v as "REGISTERED" | "GUEST")} className="grid gap-2 sm:grid-cols-2">
        <Label
          htmlFor={`${ids}-registered`}
          className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary"
        >
          <RadioGroupItem id={`${ids}-registered`} value="REGISTERED" />
          <User className="size-4" aria-hidden="true" />
          Pelanggan terdaftar
        </Label>
        <Label
          htmlFor={`${ids}-guest`}
          className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary"
        >
          <RadioGroupItem id={`${ids}-guest`} value="GUEST" />
          <UserPlus className="size-4" aria-hidden="true" />
          Tamu (tanpa akun)
        </Label>
      </RadioGroup>

      {mode === "REGISTERED" ? (
        value?.type === "REGISTERED" ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2">
            <span className="font-medium">{value.name}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Ganti pelanggan">
              <X />
            </Button>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-search`}>Cari nama, email, atau nomor HP</Label>
            <div className="relative">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input
                id={`${ids}-search`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik minimal 2 huruf..."
                className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm"
              />
            </div>
            {errors?.name && <p className="text-sm text-destructive">Pilih pelanggan terlebih dahulu.</p>}
            {query.trim().length >= 2 && (
              <div className="grid gap-1 rounded-lg border p-1">
                {search.isFetching ? (
                  <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Mencari...
                  </p>
                ) : search.data?.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Tidak ditemukan. Coba isi sebagai tamu.</p>
                ) : (
                  search.data?.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectRegistered(c)}
                      className="rounded-md p-2 text-left text-sm hover:bg-muted"
                    >
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.email} {c.phone ? `· ${c.phone}` : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id={`${ids}-guest-name`}
            label="Nama"
            value={guestName}
            onChange={(e) => {
              setGuestName(e.target.value);
              onChange({ type: "GUEST", name: e.target.value, phone: guestPhone });
            }}
            error={errors?.name}
          />
          <FormField
            id={`${ids}-guest-phone`}
            label="Nomor HP"
            type="tel"
            placeholder="081234567890"
            value={guestPhone}
            onChange={(e) => {
              setGuestPhone(e.target.value);
              onChange({ type: "GUEST", name: guestName, phone: e.target.value });
            }}
            error={errors?.phone}
          />
        </div>
      )}
    </div>
  );
}

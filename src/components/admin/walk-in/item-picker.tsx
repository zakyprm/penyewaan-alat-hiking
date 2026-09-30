"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import { ItemBadges } from "@/components/admin/item-badges";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { AdminItem } from "@/server/services/items";
import { QuickItemDialog } from "./quick-item-dialog";

export interface WalkInLine {
  item: AdminItem;
  quantity: number;
}

interface Props {
  categories: { id: string; name: string }[];
  onAdd: (item: AdminItem) => void;
  excludeIds: string[];
}

/** Cari semua alat aktif (publik + internal, Req 13.3), plus tombol tambah alat cepat (Req 13.4). */
export function ItemPicker({ categories, onAdd, excludeIds }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");

  const search = useQuery({
    queryKey: ["admin-items-search", query],
    queryFn: ({ signal }) => api<AdminItem[]>(`/admin/items?status=semua&q=${encodeURIComponent(query)}`, { signal }),
    staleTime: 15_000,
  });

  const results = (search.data ?? []).filter((i) => !excludeIds.includes(i.id));

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor={id} className="sr-only">
            Cari alat
          </label>
          <input
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari alat publik atau internal..."
            className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm"
          />
        </div>
        <QuickItemDialog categories={categories} onCreated={onAdd} />
      </div>

      {(query.trim().length > 0 || search.isFetching) && (
        <div className="grid max-h-72 gap-1 overflow-y-auto rounded-lg border p-1">
          {search.isFetching ? (
            <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Memuat...
            </p>
          ) : results.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Tidak ditemukan.</p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onAdd(item);
                  setQuery("");
                }}
                disabled={item.stock === 0}
                className="flex items-center justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {item.name}
                    <ItemBadges visibility={item.visibility} isActive={item.isActive} allowKtp={item.allowKtp} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRupiah(item.pricePerDay)}/hari · stok {item.stock}
                  </p>
                </div>
                <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

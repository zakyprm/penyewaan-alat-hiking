"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Keranjang sewa (Req 4). Disimpan di localStorage perangkat dan TIDAK mengunci stok (Req 4.4).
 * Harga di sini hanya untuk tampilan; server selalu menghitung ulang saat checkout.
 */
export interface CartLine {
  itemId: string;
  slug: string;
  name: string;
  image: string | null;
  categorySlug: string;
  pricePerDay: number;
  depositPerUnit: number;
  allowKtp: boolean;
  quantity: number;
}

interface CartState {
  /** Satu rentang waktu untuk semua alat (Req 4.1), ISO string */
  startAt: string | null;
  endAt: string | null;
  lines: CartLine[];
  /** Tambah alat. Mengembalikan true jika waktu sewa keranjang ikut berubah. */
  addLine: (line: CartLine, window: { startAt: string; endAt: string }) => { windowChanged: boolean };
  setWindow: (window: { startAt: string; endAt: string }) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  removeLine: (itemId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      startAt: null,
      endAt: null,
      lines: [],
      addLine: (line, window) => {
        const state = get();
        const windowChanged =
          state.lines.length > 0 && (state.startAt !== window.startAt || state.endAt !== window.endAt);
        const existing = state.lines.find((l) => l.itemId === line.itemId);
        set({
          ...window,
          lines: existing
            ? state.lines.map((l) => (l.itemId === line.itemId ? { ...line, quantity: line.quantity } : l))
            : [...state.lines, line],
        });
        return { windowChanged };
      },
      setWindow: (window) => set(window),
      setQuantity: (itemId, quantity) =>
        set((s) => ({ lines: s.lines.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.max(1, quantity) } : l)) })),
      removeLine: (itemId) =>
        set((s) => {
          const lines = s.lines.filter((l) => l.itemId !== itemId);
          return lines.length ? { lines } : { lines, startAt: null, endAt: null };
        }),
      clear: () => set({ lines: [], startAt: null, endAt: null }),
    }),
    { name: "sewa-hiking-cart", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

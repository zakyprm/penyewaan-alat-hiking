"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true setelah komponen berjalan di browser. Dipakai untuk data dari localStorage (keranjang)
 * supaya HTML server dan render pertama di browser sama (tanpa hydration mismatch).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

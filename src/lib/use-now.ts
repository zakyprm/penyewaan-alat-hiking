"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

/** Dibulatkan ke menit supaya nilainya stabil di antara render dalam menit yang sama. */
const snapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE;

/** Waktu sekarang (ms) yang ikut diperbarui setiap menit, aman dipakai saat render. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

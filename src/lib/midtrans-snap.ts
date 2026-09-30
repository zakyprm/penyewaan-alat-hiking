"use client";

/** Muat snap.js sekali saja per halaman, lalu buka popup pembayaran (Req 8.2). */

interface SnapResult {
  order_id: string;
  transaction_status: string;
}

interface SnapCallbacks {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: SnapCallbacks) => void };
  }
}

let loader: Promise<void> | null = null;

function loadSnapScript(snapUrl: string, clientKey: string): Promise<void> {
  if (window.snap) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${snapUrl}/snap/snap.js`;
    script.dataset.clientKey = clientKey;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Midtrans Snap. Periksa koneksi internet."));
    document.head.appendChild(script);
  });
  return loader;
}

export async function openSnapPayment(
  session: { snapToken: string; clientKey: string; snapUrl: string },
  callbacks: SnapCallbacks,
): Promise<void> {
  await loadSnapScript(session.snapUrl, session.clientKey);
  window.snap!.pay(session.snapToken, callbacks);
}

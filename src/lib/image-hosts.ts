/**
 * Host gambar eksternal yang diizinkan (selain upload lokal `/uploads/items/...`).
 * Dipakai oleh validasi foto alat (`imageUrlSchema`) dan `images.remotePatterns` di next.config.ts.
 *
 * placehold.co: placeholder PNG untuk data dummy seed, sampai foto asli diunggah admin.
 */
export const ALLOWED_IMAGE_HOSTS = ["placehold.co"] as const;

/**
 * Subdomain dari store Vercel Blob (produksi): https://<store-id>.public.blob.vercel-storage.com/...
 * Store-id unik per store, jadi dicocokkan lewat pola, bukan daftar statis seperti ALLOWED_IMAGE_HOSTS.
 */
const BLOB_HOST_PATTERN = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

export function isAllowedExternalImage(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname) || BLOB_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

/** Placeholder bertuliskan nama alat, warna tema (hijau hutan). Format PNG agar bisa dioptimasi next/image. */
export function placeholderImage(label: string): string {
  return `https://placehold.co/800x600/2F5D50/FFFFFF.png?text=${encodeURIComponent(label).replace(/%20/g, "+")}`;
}

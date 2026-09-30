/**
 * Host gambar eksternal yang diizinkan (selain upload lokal `/uploads/items/...`).
 * Dipakai oleh validasi foto alat (`imageUrlSchema`) dan `images.remotePatterns` di next.config.ts.
 *
 * placehold.co: placeholder PNG untuk data dummy seed, sampai foto asli diunggah admin.
 */
export const ALLOWED_IMAGE_HOSTS = ["placehold.co"] as const;

export function isAllowedExternalImage(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

/** Placeholder bertuliskan nama alat, warna tema (hijau hutan). Format PNG agar bisa dioptimasi next/image. */
export function placeholderImage(label: string): string {
  return `https://placehold.co/800x600/2F5D50/FFFFFF.png?text=${encodeURIComponent(label).replace(/%20/g, "+")}`;
}

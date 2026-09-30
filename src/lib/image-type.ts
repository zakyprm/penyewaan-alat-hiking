export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (design 9)

export type ImageType = { ext: "jpg" | "png" | "webp"; mime: "image/jpeg" | "image/png" | "image/webp" };

/**
 * Deteksi tipe gambar dari isi file (magic bytes), bukan dari nama file atau MIME
 * yang dikirim klien. Mengembalikan null untuk tipe yang tidak diizinkan.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  if (starts([0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  // RIFF....WEBP
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", mime: "image/webp" };
  return null;
}

export const IMAGE_MIME_BY_EXT: Record<ImageType["ext"], ImageType["mime"]> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/domain/errors";
import { detectImageType, IMAGE_MIME_BY_EXT, MAX_IMAGE_BYTES, type ImageType } from "@/lib/image-type";

/**
 * Penyimpanan foto alat.
 *
 * Saat ini: folder lokal `storage/uploads` (di luar `public/`, karena `next start` hanya melayani
 * isi `public/` yang ada saat build). File dilayani oleh route `src/app/uploads/[...path]/route.ts`.
 *
 * Saat deploy ke Vercel (Task 16), ganti implementasi dua fungsi di bawah dengan Vercel Blob.
 * Filesystem Vercel tidak persisten, jadi penyimpanan lokal hanya untuk development.
 */
const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");
const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function saveItemImage(file: File): Promise<string> {
  if (file.size === 0) throw new DomainError("VALIDASI_GAGAL", "File foto kosong.");
  if (file.size > MAX_IMAGE_BYTES) throw new DomainError("VALIDASI_GAGAL", "Ukuran foto maksimal 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new DomainError("VALIDASI_GAGAL", "Format foto harus JPG, PNG, atau WebP.");

  const name = `${randomUUID()}.${type.ext}`;
  const dir = path.join(UPLOAD_ROOT, "items");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes, { flag: "wx" });
  return `/uploads/items/${name}`;
}

/** Baca file upload. Nama file divalidasi ketat sehingga path traversal (../) tidak mungkin. */
export async function readUpload(segments: string[]): Promise<{ bytes: Uint8Array; mime: ImageType["mime"] } | null> {
  if (segments.length !== 2 || segments[0] !== "items" || !FILE_NAME.test(segments[1])) return null;
  try {
    const bytes = await readFile(path.join(UPLOAD_ROOT, "items", segments[1]));
    const ext = segments[1].split(".").pop() as ImageType["ext"];
    return { bytes: new Uint8Array(bytes), mime: IMAGE_MIME_BY_EXT[ext] };
  } catch {
    return null;
  }
}

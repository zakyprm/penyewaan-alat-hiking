import "server-only";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/domain/errors";
import { detectImageType, IMAGE_MIME_BY_EXT, MAX_IMAGE_BYTES, type ImageType } from "@/lib/image-type";

/**
 * Penyimpanan foto alat.
 *
 * Produksi (Vercel): Vercel Blob (store publik). Vercel menyuntikkan kredensial OIDC otomatis
 * ke Vercel Functions saat runtime — tidak perlu `BLOB_READ_WRITE_TOKEN` di kode maupun env var
 * (lihat https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication).
 * Dideteksi lewat env var `VERCEL` yang disetel otomatis oleh platform Vercel di semua environment.
 *
 * Development lokal: folder `storage/uploads` (di luar `public/`, karena `next start` hanya
 * melayani isi `public/` yang ada saat build). Dilayani oleh `src/app/uploads/[...path]/route.ts`.
 * Filesystem Vercel tidak persisten antar deployment/instance, jadi mode ini tidak dipakai di produksi.
 */
const USE_BLOB = process.env.VERCEL === "1";

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");
const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function saveItemImage(file: File): Promise<string> {
  if (file.size === 0) throw new DomainError("VALIDASI_GAGAL", "File foto kosong.");
  if (file.size > MAX_IMAGE_BYTES) throw new DomainError("VALIDASI_GAGAL", "Ukuran foto maksimal 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new DomainError("VALIDASI_GAGAL", "Format foto harus JPG, PNG, atau WebP.");

  const name = `${randomUUID()}.${type.ext}`;

  if (USE_BLOB) {
    const blob = await put(`items/${name}`, Buffer.from(bytes), {
      access: "public",
      contentType: type.mime,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const dir = path.join(UPLOAD_ROOT, "items");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes, { flag: "wx" });
  return `/uploads/items/${name}`;
}

/**
 * Baca file upload lokal (dev saja). Nama file divalidasi ketat sehingga path traversal (../)
 * tidak mungkin. Di produksi, foto dilayani langsung dari URL publik Vercel Blob (bukan lewat route ini).
 */
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

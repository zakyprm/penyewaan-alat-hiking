import { readUpload } from "@/server/storage";

/** GET /uploads/items/<uuid>.<ext> — foto alat (publik). Nama file unik, jadi aman di-cache selamanya. */
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path } = await ctx.params;
  const file = await readUpload(path);
  if (!file) return new Response("Tidak ditemukan", { status: 404 });

  return new Response(new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.mime }), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

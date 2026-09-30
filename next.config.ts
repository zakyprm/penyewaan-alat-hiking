import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/image-hosts";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Host statis yang ada di src/lib/image-hosts.ts
      ...ALLOWED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
      // Store Vercel Blob (produksi): https://<store-id>.public.blob.vercel-storage.com/...
      { protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;

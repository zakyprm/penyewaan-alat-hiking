import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integration test terhadap PostgreSQL test (sewa_hiking_test). Jalankan: npm run test:int */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["./src/test/int-global-setup.ts"],
    setupFiles: ["./src/test/int-env.ts"],
    // Semua file berbagi satu database: jalankan berurutan
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

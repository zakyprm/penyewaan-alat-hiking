import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Modul server (service, auth) mengimpor "server-only", yang sengaja melempar error di luar Next.js.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration test butuh database: npm run test:int
    exclude: ["src/**/*.int.test.ts", "node_modules/**"],
  },
});

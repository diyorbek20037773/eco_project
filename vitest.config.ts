import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint_test";

// Eslatma: Git Bash'da cwd "d:\…" (kichik harf) bo'lsa vitest root'ni "D:\…" deb oladi va o'z modulini
// ikki marta yuklaydi. PowerShell/cmd'da muammo yo'q; Git Bash'da `npx vitest run --root . --project unit`.
export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(root, "src") }],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          // Testlar hech qachon ish bazasiga yozmaydi: DATABASE_URL test bazasiga almashtiriladi.
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            TEST_DATABASE_URL,
            STORAGE_DIR: "./storage/test-uploads",
            SESSION_SECRET: "test-only-session-secret-0123456789abcdef",
            DEMO_MODE: "true",
          },
          globalSetup: ["tests/db/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});

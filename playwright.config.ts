import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// E2E: production build + `next start` 3100-portda, faqat TEST bazasi bilan.
// 3000-port (orkestratorning `next dev`) ga tegilmaydi.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint_test";
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

const dbName = decodeURIComponent(new URL(TEST_DATABASE_URL).pathname.replace(/^\//, ""));
if (!dbName.endsWith("_test")) {
  throw new Error(`E2E faqat "*_test" nomli bazada ishlaydi (hozir: "${dbName}").`);
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  globalSetup: "./tests/e2e/global-setup.ts",
  // Oqimlar umumiy DB holatiga bog'liq — ketma-ket.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }], ["html", { open: "never" }]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "uz-Latn-UZ",
    timezoneId: "Asia/Tashkent",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // E2E_SKIP_BUILD=1 — faqat lokal takroriy yurgizish uchun (yakuniy sinov doim build bilan).
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL,
      STORAGE_DIR: "./storage/test-uploads",
      SESSION_SECRET: "e2e-only-session-secret-0123456789abcdef-qarshi-pilot",
      DEMO_MODE: "true",
      APP_URL: BASE_URL,
      PORT: String(PORT),
    },
  },
});

// E2E oldidan: TEST bazasini tozalab seed qiladi (faqat *_test), so'ng production rejimida
// kirish uchun demo akkauntlardan isDemo belgisini olib tashlaydi (FAQAT test bazasida).
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { makePng } from "./png";

export default async function globalSetup(): Promise<void> {
  const root = path.resolve(import.meta.dirname, "..", "..");
  const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint_test";
  const dbName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ""));
  if (!dbName.endsWith("_test")) throw new Error(`Rad etildi: "${dbName}" test bazasi emas.`);

  const env: NodeJS.ProcessEnv = { ...process.env, TEST_DATABASE_URL: testUrl, DATABASE_URL: testUrl, NODE_ENV: "development" };
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "reset-test-db.mjs"), "--seed"], { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`Test bazasini tayyorlab bo'lmadi:\n${r.stdout}\n${r.stderr}`);

  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    const cur = await client.query<{ db: string }>("SELECT current_database() AS db");
    if (!cur.rows[0]?.db.endsWith("_test")) throw new Error("Ulanish test bazasiga emas.");
    await client.query(`UPDATE "User" SET "isDemo" = false`);
  } finally {
    await client.end();
  }

  // Kichik haqiqiy PNG fixture (tarozi / karton rasmi uchun).
  const dir = path.join(root, "tests", "e2e", "fixtures");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "karton.png"), makePng(16, 12, [176, 132, 80]));
  writeFileSync(path.join(dir, "tarozi.png"), makePng(20, 14, [23, 105, 71]));
  mkdirSync(path.join(root, "test-results", "screens"), { recursive: true });
}

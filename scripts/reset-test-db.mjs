#!/usr/bin/env node
// Izolyatsiyalangan TEST bazasini tozalaydi: migratsiyalarni qo'llaydi va barcha jadvallarni TRUNCATE qiladi.
// Xavfsizlik: faqat nomi "_test" bilan tugaydigan bazada va DATABASE_URL (ish bazasi) bilan teng bo'lmaganda ishlaydi.
// Foydalanish: node scripts/reset-test-db.mjs [--seed]
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import pg from "pg";

const ROOT = resolve(import.meta.dirname, "..");
const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint_test";
const mainUrl = process.env.MAIN_DATABASE_URL ?? process.env.DATABASE_URL;

const dbName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ""));
if (!dbName.endsWith("_test")) {
  console.error(`Rad etildi: test bazasi nomi "_test" bilan tugashi kerak (hozir: "${dbName}").`);
  process.exit(1);
}
if (mainUrl && mainUrl === testUrl && process.env.MAIN_DATABASE_URL) {
  console.error("Rad etildi: TEST_DATABASE_URL ish bazasi bilan bir xil.");
  process.exit(1);
}

function run(args) {
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: testUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    process.exit(r.status ?? 1);
  }
  return r;
}

run([join(ROOT, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"]);

const client = new pg.Client({ connectionString: testUrl });
await client.connect();
const { rows } = await client.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
);
if (rows.length > 0) {
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
await client.end();
console.log(`Test bazasi tozalandi: ${dbName} (${rows.length} jadval).`);

if (process.argv.includes("--seed")) {
  run([join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), join(ROOT, "prisma", "seed.ts")]);
  console.log("Test bazasiga seed qo'llandi.");
}

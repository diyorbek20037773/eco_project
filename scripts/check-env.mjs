#!/usr/bin/env node
// Production start oldidan tekshiruv: muhit o'zgaruvchilari to'g'rimi va baza javob beradimi.
// Noto'g'ri sozlamada tushunarsiz "localhost:5433" xatosi o'rniga aniq ko'rsatma chiqaradi.
// Foydalanish: node scripts/check-env.mjs  (railway.json startCommand ichida, migratsiyadan oldin)
import "dotenv/config";
import pg from "pg";

const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);
const production = process.env.NODE_ENV === "production" || onRailway;
const errors = [];

function fail(msg) {
  errors.push(msg);
}

const url = process.env.DATABASE_URL;
if (!url) {
  fail(
    onRailway
      ? "DATABASE_URL o‘rnatilmagan. Railway → ilova servisi → Variables → New Variable: DATABASE_URL = ${{Postgres.DATABASE_URL}} (avval loyihaga PostgreSQL servisini qo‘shing)."
      : "DATABASE_URL o‘rnatilmagan. .env fayliga PostgreSQL manzilini yozing (README, 2–4-bo‘limlar).",
  );
} else {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    fail("DATABASE_URL noto‘g‘ri formatda. Namuna: postgresql://user:parol@host:5432/baza");
  }
  if (onRailway && (host === "localhost" || host === "127.0.0.1")) {
    fail("Railway’da DATABASE_URL localhost’ga qaragan. Variables’da DATABASE_URL = ${{Postgres.DATABASE_URL}} qiling.");
  }
}

if (production) {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32 || secret.startsWith("change-me")) {
    fail("SESSION_SECRET kamida 32 belgili tasodifiy satr bo‘lishi kerak (Variables → SESSION_SECRET).");
  }
  if (onRailway && process.env.STORAGE_DIR && !process.env.STORAGE_DIR.startsWith("/")) {
    fail("STORAGE_DIR absolyut yo‘l bo‘lsin, masalan /data/uploads (Volume /data ga ulangan).");
  }
}

if (errors.length) {
  console.error("\n[ecopoint] Ishga tushirib bo‘lmadi — sozlamani tuzating:");
  for (const e of errors) console.error("  • " + e);
  console.error("");
  process.exit(1);
}

// Baza servisi kechroq ko'tarilishi mumkin — 60 soniyagacha kutamiz.
const deadline = Date.now() + 60_000;
let lastError = "";
for (let attempt = 1; Date.now() < deadline; attempt++) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    console.log(`[ecopoint] Baza tayyor (${attempt}-urinish).`);
    process.exit(0);
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    await client.end().catch(() => {});
    await new Promise((r) => setTimeout(r, 3_000));
  }
}
console.error(`\n[ecopoint] Bazaga 60 soniya ichida ulanib bo‘lmadi: ${lastError}`);
console.error(
  onRailway
    ? "  • PostgreSQL servisi ishlayotganini va DATABASE_URL = ${{Postgres.DATABASE_URL}} ekanini tekshiring.\n"
    : "  • Lokal bazani ishga tushiring: npm run db:local (yoki docker compose up -d).\n",
);
process.exit(1);

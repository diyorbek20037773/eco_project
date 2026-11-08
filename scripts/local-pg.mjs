#!/usr/bin/env node
// Loyiha ichida alohida PostgreSQL klasterini (.local/pgdata) yaratadi va ishga tushiradi.
// Docker bo'lmasa, lekin kompyuterda PostgreSQL o'rnatilgan bo'lsa ishlatiladi.
// Foydalanish: node scripts/local-pg.mjs start | stop | status
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = join(ROOT, ".local", "pgdata");
const LOG = join(ROOT, ".local", "pg.log");
const PORT = process.env.LOCAL_PG_PORT ?? "5433";
const USER = "ecopoint";
const PASSWORD = "ecopoint_local";
const isWin = process.platform === "win32";

function findBin(name) {
  const exe = isWin ? `${name}.exe` : name;
  const which = spawnSync(isWin ? "where" : "which", [exe], { encoding: "utf8" });
  if (which.status === 0) return which.stdout.split(/\r?\n/)[0].trim();
  const candidates = [];
  if (isWin) {
    const base = "C:\\Program Files\\PostgreSQL";
    if (existsSync(base)) {
      for (const v of readdirSync(base).sort((a, b) => Number(b) - Number(a))) candidates.push(join(base, v, "bin", exe));
    }
  } else {
    for (const v of ["18", "17", "16", "15"]) {
      candidates.push(`/usr/lib/postgresql/${v}/bin/${exe}`, `/opt/homebrew/opt/postgresql@${v}/bin/${exe}`);
    }
  }
  const found = candidates.find((c) => existsSync(c));
  if (!found) {
    console.error(`"${name}" topilmadi. PostgreSQL o'rnating yoki Docker Compose / tashqi DATABASE_URL dan foydalaning.`);
    process.exit(1);
  }
  return found;
}

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: "utf8", ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(r.stdout, r.stderr);
    process.exit(r.status ?? 1);
  }
  return r;
}

const cmd = process.argv[2] ?? "start";
const pgCtl = findBin("pg_ctl");

if (cmd === "status") {
  const r = run(pgCtl, ["-D", DATA, "status"], { allowFail: true });
  console.log(r.stdout || r.stderr);
  process.exit(0);
}

if (cmd === "stop") {
  if (!existsSync(DATA)) process.exit(0);
  run(pgCtl, ["-D", DATA, "-m", "fast", "stop"], { allowFail: true });
  console.log("Lokal PostgreSQL to'xtatildi.");
  process.exit(0);
}

if (!existsSync(join(DATA, "PG_VERSION"))) {
  mkdirSync(join(ROOT, ".local"), { recursive: true });
  const pwFile = join(tmpdir(), `ecopoint-pw-${process.pid}`);
  writeFileSync(pwFile, PASSWORD);
  console.log("Yangi lokal klaster yaratilmoqda:", DATA);
  run(findBin("initdb"), ["-D", DATA, "-U", USER, `--pwfile=${pwFile}`, "-A", "scram-sha-256", "-E", "UTF8", "--locale=C"]);
  rmSync(pwFile, { force: true });
}

const status = run(pgCtl, ["-D", DATA, "status"], { allowFail: true });
if (status.status !== 0) {
  // -w: tayyor bo'lguncha kutadi. Log fayliga yoziladi, terminal band qilinmaydi.
  run(pgCtl, ["-D", DATA, "-l", LOG, "-o", `-p ${PORT} -c listen_addresses=localhost`, "-w", "start"], { stdio: "ignore" });
}

const psql = findBin("psql");
const env = { ...process.env, PGPASSWORD: PASSWORD };
for (const db of ["ecopoint", "ecopoint_test"]) {
  const exists = run(psql, ["-h", "localhost", "-p", PORT, "-U", USER, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${db}'`], { env });
  if (exists.stdout.trim() !== "1") {
    run(psql, ["-h", "localhost", "-p", PORT, "-U", USER, "-d", "postgres", "-c", `CREATE DATABASE ${db}`], { env });
    console.log(`Baza yaratildi: ${db}`);
  }
}
console.log(`Lokal PostgreSQL tayyor: postgresql://${USER}:${PASSWORD}@localhost:${PORT}/ecopoint`);

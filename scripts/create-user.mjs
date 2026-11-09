#!/usr/bin/env node
// Pilot foydalanuvchisini yaratish — production obrazida ham ishlaydi (faqat pg + node:crypto, tsx kerak emas).
//   node scripts/create-user.mjs --role OPERATOR --login ali --name "Ali Valiyev" [--phone "+998 90 ..."] [--shop-id <id>] [--password <parol>]
// Parol --password yoki NEW_USER_PASSWORD dan (kamida 10 belgi). Parol xeshi src/lib/auth/password.ts bilan bir xil formatda.
import "dotenv/config";
import { randomBytes, randomUUID, scrypt as scryptCb } from "node:crypto";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import pg from "pg";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;
export const MIN_PASSWORD_LENGTH = 10;
const ROLES = ["SHOP", "COLLECTOR", "OPERATOR"];

/** scrypt$N$r$p$<salt base64url>$<hash base64url> — ilovadagi verifyPassword bilan mos. */
export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$")),
    );
  });
}

function fail(msg) {
  console.error(`Xato: ${msg}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      role: { type: "string" },
      login: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
      "shop-id": { type: "string" },
      password: { type: "string" },
    },
  });
  const role = (values.role ?? "").toUpperCase();
  if (!ROLES.includes(role)) fail("--role SHOP | COLLECTOR | OPERATOR bo‘lishi kerak.");
  const login = (values.login ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) fail("--login 3–32 belgi: lotin harflari, raqam, nuqta, chiziqcha.");
  const name = (values.name ?? "").trim();
  if (name.length < 2) fail('--name kiriting (masalan "Ali Valiyev").');
  const password = values.password ?? process.env.NEW_USER_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) fail(`Parol kamida ${MIN_PASSWORD_LENGTH} belgi bo‘lsin (--password yoki NEW_USER_PASSWORD).`);
  const shopId = values["shop-id"]?.trim() || null;
  if (!process.env.DATABASE_URL) fail("DATABASE_URL o‘rnatilmagan.");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (role === "SHOP") {
      if (!shopId) {
        const { rows } = await client.query('SELECT id, name FROM "Shop" ORDER BY name');
        console.error("Do‘kon xodimi uchun --shop-id kerak. Mavjud do‘konlar:");
        for (const s of rows) console.error(`  ${s.id}  ${s.name}`);
        fail("--shop-id ko‘rsatilmagan.");
      }
      const { rowCount } = await client.query('SELECT 1 FROM "Shop" WHERE id = $1', [shopId]);
      if (!rowCount) fail(`Do‘kon topilmadi: ${shopId}`);
    } else if (shopId) {
      fail("--shop-id faqat SHOP roli uchun.");
    }
    const exists = await client.query('SELECT 1 FROM "User" WHERE login = $1', [login]);
    if (exists.rowCount) fail(`Bu login band: ${login}`);

    const id = randomUUID();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "User" (id, login, name, phone, role, "passwordHash", "isDemo", "isActive", "shopId", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"Role", $6, false, true, $7, now())`,
      [id, login, name, values.phone?.trim() || null, role, await hashPassword(password), shopId],
    );
    await client.query(
      `INSERT INTO "AuditEvent" (id, "actorId", action, "entityType", "entityId", after) VALUES ($1, NULL, 'USER_CREATED', 'User', $2, $3)`,
      [randomUUID(), id, JSON.stringify({ login, role, shopId, via: "cli" })],
    );
    await client.query("COMMIT");
    console.log(`Foydalanuvchi yaratildi: ${login} (${role})${shopId ? `, do‘kon ${shopId}` : ""}.`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// Parol xeshi: node:crypto scrypt (tashqi paketsiz).
// Format: scrypt$N$r$p$<salt base64url>$<hash base64url>
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;
export const MIN_PASSWORD_LENGTH = 10;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nS, rS, pS, saltS, hashS] = parts as [string, string, string, string, string, string];
  const n = Number(nS);
  const r = Number(rS);
  const p = Number(pS);
  if (![n, r, p].every((x) => Number.isSafeInteger(x) && x > 0)) return false;
  const salt = Buffer.from(saltS, "base64url");
  const expected = Buffer.from(hashS, "base64url");
  if (expected.length === 0) return false;
  const actual = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Login mavjud bo'lmaganda ham vaqt bir xil sarflansin (foydalanuvchi borligini oshkor qilmaslik).
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("ecopoint-dummy-password");
  await verifyPassword(password, await dummyHash);
}

// Mahalliy yopiq fayl ombori. Fayllar public/ ichida EMAS — faqat /api/files/<id> orqali,
// sessiya va obyekt ruxsati tekshirilgandan keyin beriladi. Restartdan keyin ham saqlanadi.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function storageRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR || "./storage/uploads");
}

/** Haqiqiy rasm turini fayl boshidagi baytlar (magic bytes) bo'yicha aniqlaydi. */
export function detectImageMime(buf: Uint8Array): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

const EXT: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface StoredFile {
  storageKey: string;
  mimeType: ImageMime;
  sizeBytes: number;
  sha256: string;
}

export type ValidateResult = { ok: true; mime: ImageMime } | { ok: false; reason: "EMPTY" | "TOO_LARGE" | "NOT_IMAGE" };

export function validateImage(buf: Uint8Array): ValidateResult {
  if (buf.length === 0) return { ok: false, reason: "EMPTY" };
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "TOO_LARGE" };
  const mime = detectImageMime(buf);
  if (!mime) return { ok: false, reason: "NOT_IMAGE" };
  return { ok: true, mime };
}

/** Tekshirilgan rasmni tasodifiy nom bilan saqlaydi. */
export async function saveImage(buf: Uint8Array, mime: ImageMime): Promise<StoredFile> {
  const now = new Date();
  const dir = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storageKey = `${dir}/${randomBytes(18).toString("base64url")}.${EXT[mime]}`;
  const full = resolveKey(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: "wx" });
  return { storageKey, mimeType: mime, sizeBytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

function resolveKey(storageKey: string): string {
  if (!/^[0-9]{6}\/[A-Za-z0-9_-]{10,64}\.(jpg|png|webp)$/.test(storageKey)) throw new Error("Noto'g'ri storageKey");
  const root = storageRoot();
  const full = path.resolve(/*turbopackIgnore: true*/ root, storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error("Noto'g'ri storageKey");
  return full;
}

export async function readStoredFile(storageKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(storageKey));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    await rm(resolveKey(storageKey), { force: true });
  } catch {
    // e'tiborsiz
  }
}

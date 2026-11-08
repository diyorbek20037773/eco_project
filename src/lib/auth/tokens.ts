// Sessiya tokeni: tasodifiy 32 bayt; DB'da faqat HMAC-SHA256(SESSION_SECRET, token) saqlanadi.
import { createHmac, randomBytes } from "node:crypto";
import { getSessionSecret } from "./secret";

export const SESSION_COOKIE = "ep_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionIdFromToken(token: string): string {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

// Sessiya sirini o'qish. Production'da zaif yoki standart sir bilan ishga tushmaydi.
const DEFAULT_SECRETS = new Set(["change-me-to-a-long-random-string-at-least-32-chars", "change-me", ""]);
const DEV_FALLBACK = "ecopoint-dev-only-session-secret-not-for-production";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32 || DEFAULT_SECRETS.has(secret)) {
      throw new Error("SESSION_SECRET production uchun kamida 32 belgili, tasodifiy va standartdan farqli bo'lishi kerak.");
    }
    return secret;
  }
  return secret.length >= 16 ? secret : DEV_FALLBACK;
}

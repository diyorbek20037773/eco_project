// Til sozlamalari. Asosiy til — o‘zbek (lotin). Tanlov `ep_lang` cookie’da saqlanadi.
export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "ep_lang";

export const LOCALE_SHORT: Record<Locale, string> = { uz: "UZ", ru: "RU", en: "EN" };
export const LOCALE_NAME: Record<Locale, string> = { uz: "O‘zbekcha", ru: "Русский", en: "English" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** "{n} ta nuqta" + { n: 2 } → "2 ta nuqta". Lug‘at mijozga uzatiladi, shuning uchun funksiyalar emas, shablonlar. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

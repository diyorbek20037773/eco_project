import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { DICTIONARIES, type Dict } from "./dictionaries";

/** Joriy til (cookie’dan; bo‘lmasa o‘zbek). */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getDict(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale] };
}

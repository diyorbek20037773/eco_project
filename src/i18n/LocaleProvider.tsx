"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Root layout’da o‘rnatiladi: barcha mijoz komponentlari joriy tilni `useLocale()` bilan oladi. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Bo‘lim lug‘atidan joriy tilnikini tanlaydi: `const t = useDict(SHOP_DICT)`. */
export function useDict<T>(dicts: Record<Locale, T>): T {
  return dicts[useLocale()];
}

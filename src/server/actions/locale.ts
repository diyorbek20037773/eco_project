"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/** Interfeys tilini saqlaydi (1 yil). Noto‘g‘ri qiymat e’tiborsiz qoldiriladi. */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

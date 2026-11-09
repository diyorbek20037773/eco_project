"use client";

import { COMMON_DICT, type CommonDict } from "@/i18n/common";
import { useDict } from "@/i18n/LocaleProvider";

/**
 * Server va mijozda birdek ishlatiladigan komponentlar (Button, PageSkeleton) uchun standart matn:
 * joriy tilni o‘zi oladi. Masalan `<UiText k="loading" />` → «Yuklanmoqda…».
 */
export function UiText({ k }: { k: keyof CommonDict["ui"] }) {
  return <>{useDict(COMMON_DICT).ui[k]}</>;
}

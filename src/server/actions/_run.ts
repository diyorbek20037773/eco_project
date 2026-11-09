// Server action'lar uchun umumiy o'ram (bu fayl "use server" emas — faqat ichki yordamchi).
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/server/contract";
import { internalError, MESSAGES } from "@/domain/errors";
import { getSessionUser } from "@/server/queries/session";
import type { Actor } from "@/server/services/core";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { localizeResult } from "@/i18n/messages";

export type Section = "shop" | "collector" | "operator";

const SECTION_PATH: Record<Section, string> = { shop: "/shop", collector: "/collector", operator: "/operator" };

/** Joriy til (ep_lang cookie). So'rov konteksti bo'lmasa — o'zbek (natija o'zgarmaydi). */
export async function currentLocale(): Promise<Locale> {
  try {
    return await getLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Natijadagi foydalanuvchi matnlarini tanlangan tilga o'giradi (uz — aynan o'sha obyekt). */
async function localized<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  return localizeResult(result, await currentLocale());
}

/** Sessiyani o'qiydi, servisni chaqiradi, muvaffaqiyatda tegishli bo'limlarni yangilaydi. */
export async function withActor<T>(sections: Section[], fn: (actor: Actor) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const user = await getSessionUser();
    if (!user) return localized({ ok: false, code: "UNAUTHENTICATED", error: MESSAGES.UNAUTHENTICATED });
    const result = await fn({ id: user.id, role: user.role, shopId: user.shopId, name: user.name });
    if (result.ok) for (const s of sections) revalidatePath(SECTION_PATH[s], "layout");
    return localized(result);
  } catch (e) {
    console.error("[ecopoint] server action xatosi:", e);
    return localized(internalError());
  }
}

// Server action'lar uchun umumiy o'ram (bu fayl "use server" emas — faqat ichki yordamchi).
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/server/contract";
import { internalError, MESSAGES } from "@/domain/errors";
import { getSessionUser } from "@/server/queries/session";
import type { Actor } from "@/server/services/core";

export type Section = "shop" | "collector" | "operator";

const SECTION_PATH: Record<Section, string> = { shop: "/shop", collector: "/collector", operator: "/operator" };

/** Sessiyani o'qiydi, servisni chaqiradi, muvaffaqiyatda tegishli bo'limlarni yangilaydi. */
export async function withActor<T>(sections: Section[], fn: (actor: Actor) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const user = await getSessionUser();
    if (!user) return { ok: false, code: "UNAUTHENTICATED", error: MESSAGES.UNAUTHENTICATED };
    const result = await fn({ id: user.id, role: user.role, shopId: user.shopId, name: user.name });
    if (result.ok) for (const s of sections) revalidatePath(SECTION_PATH[s], "layout");
    return result;
  } catch (e) {
    console.error("[ecopoint] server action xatosi:", e);
    return internalError();
  }
}

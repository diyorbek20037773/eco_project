"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { homeFor, routes } from "@/lib/routes";
import type { LoginState, Role } from "@/server/contract";
import { authenticate } from "@/server/services/auth";
import { translateMessage } from "@/i18n/messages";
import { currentLocale } from "./_run";
import { prisma } from "@/lib/db";
import { isOpenAccess } from "@/lib/open-access";
import { DEMO_USERS } from "@/server/demo";
import { ensureDemoData } from "@/server/open-access";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = await currentLocale();
  if (!login || !password) return { error: translateMessage("Login va parolni kiriting.", locale), login };
  let role: Role;
  try {
    const r = await authenticate(login, password);
    if (!r.ok) return { error: translateMessage(r.error, locale), login };
    await createSession(r.userId);
    role = r.role;
  } catch (e) {
    console.error("[ecopoint] login xatosi:", e);
    return { error: translateMessage("Kutilmagan xato. Qayta urinib ko‘ring.", locale), login };
  }
  redirect(homeFor(role));
}

export async function logoutAction(): Promise<void> {
  try {
    await destroySession();
  } catch (e) {
    console.error("[ecopoint] logout xatosi:", e);
  }
  redirect(routes.login);
}

/**
 * Ochiq kirish (OPEN_ACCESS=true): rol kartasi bosilganda parolsiz kiradi.
 * Faqat ro‘yxatdagi demo akkauntlar; rejim o‘chiq bo‘lsa hech narsa qilmaydi.
 */
export async function enterAsAction(formData: FormData): Promise<void> {
  if (!isOpenAccess()) redirect(routes.login);
  const login = String(formData.get("login") ?? "");
  if (!DEMO_USERS.some((u) => u.login === login)) redirect(routes.login);
  let role: Role;
  try {
    await ensureDemoData();
    const user = await prisma.user.findUnique({ where: { login }, select: { id: true, role: true, isActive: true } });
    if (!user || !user.isActive) redirect(routes.login);
    await createSession(user.id);
    role = user.role;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    console.error("[ecopoint] ochiq kirish xatosi:", e);
    redirect(`${routes.login}?error=1`);
  }
  redirect(homeFor(role));
}

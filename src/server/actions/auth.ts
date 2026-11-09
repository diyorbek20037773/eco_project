"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { homeFor, routes } from "@/lib/routes";
import type { LoginState, Role } from "@/server/contract";
import { authenticate } from "@/server/services/auth";
import { translateMessage } from "@/i18n/messages";
import { currentLocale } from "./_run";

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

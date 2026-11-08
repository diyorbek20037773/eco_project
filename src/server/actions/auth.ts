"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { homeFor, routes } from "@/lib/routes";
import type { LoginState, Role } from "@/server/contract";
import { authenticate } from "@/server/services/auth";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!login || !password) return { error: "Login va parolni kiriting.", login };
  let role: Role;
  try {
    const r = await authenticate(login, password);
    if (!r.ok) return { error: r.error, login };
    await createSession(r.userId);
    role = r.role;
  } catch (e) {
    console.error("[ecopoint] login xatosi:", e);
    return { error: "Kutilmagan xato. Qayta urinib ko‘ring.", login };
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

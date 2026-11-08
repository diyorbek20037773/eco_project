// Sessiya so'rovlari (faqat server). "server-only" — Next.js ichki taqdim etadi (alohida paket shart emas).
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionUser } from "@/lib/auth/session";
import { homeFor, routes } from "@/lib/routes";
import type { AppInfo, DemoAccount, Role, SessionUser } from "@/server/contract";
import { demoAccounts } from "@/server/demo";

export const getSessionUser = cache(async (): Promise<SessionUser | null> => readSessionUser());

export async function requireUser(role?: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(routes.login);
  if (role && user.role !== role) redirect(homeFor(user.role));
  return user;
}

export function getAppInfo(): AppInfo {
  return {
    demoMode: process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production",
    appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  };
}

export function getDemoAccounts(): DemoAccount[] {
  return getAppInfo().demoMode ? demoAccounts() : [];
}

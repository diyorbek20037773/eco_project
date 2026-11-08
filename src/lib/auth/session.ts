// Server sessiyasi: httpOnly cookie + DB yozuvi. Faqat server kodida ishlatiladi.
import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/server/contract";
import { SESSION_COOKIE, SESSION_TTL_MS, newSessionToken, sessionIdFromToken } from "./tokens";

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

/** Yangi sessiya yaratib cookie o'rnatadi (server action yoki route handler ichida). */
export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: sessionIdFromToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: sessionIdFromToken(token) } });
  }
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

/** Cookie'dagi token bo'yicha foydalanuvchini o'qiydi. Yaroqsiz bo'lsa null. */
export async function readSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  return userForToken(token);
}

export async function userForToken(token: string): Promise<SessionUser | null> {
  const id = sessionIdFromToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { include: { shop: { select: { name: true } } } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  const u = session.user;
  if (!u.isActive) return null;
  if (u.isDemo && process.env.NODE_ENV === "production") return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.updateMany({ where: { id }, data: { lastSeenAt: new Date(now) } });
  }
  return {
    id: u.id,
    name: u.name,
    login: u.login,
    role: u.role,
    shopId: u.shopId,
    shopName: u.shop?.name ?? null,
    isDemo: u.isDemo,
  };
}

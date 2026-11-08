// Login tekshiruvi (cookie'siz — sessiyani action yaratadi).
import { prisma } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import type { Role } from "@/server/contract";

export const LOGIN_FAILED = "Login yoki parol noto‘g‘ri.";

export type AuthResult = { ok: true; userId: string; role: Role } | { ok: false; error: string };

export async function authenticate(loginRaw: string, password: string): Promise<AuthResult> {
  const login = loginRaw.trim().toLowerCase();
  if (!login || !password || login.length > 64 || password.length > 200) return { ok: false, error: LOGIN_FAILED };
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    await burnPasswordCheck(password);
    return { ok: false, error: LOGIN_FAILED };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: LOGIN_FAILED };
  if (!user.isActive) return { ok: false, error: "Akkaunt o‘chirilgan. Operatorga murojaat qiling." };
  if (user.isDemo && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Demo akkauntlar ishlab chiqarish rejimida ishlamaydi." };
  }
  return { ok: true, userId: user.id, role: user.role };
}

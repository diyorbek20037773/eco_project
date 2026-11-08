import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[ecopoint] health: DB ulanmadi", e);
    return Response.json({ ok: false, error: "Ma’lumotlar bazasiga ulanib bo‘lmadi." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

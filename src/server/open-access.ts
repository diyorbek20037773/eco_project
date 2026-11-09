import "server-only";
import { prisma } from "@/lib/db";
import { runSeed } from "../../prisma/seed";

// Ochiq kirish rejimida baza bo‘sh bo‘lsa, birinchi kirishda demo ma’lumotlar bir marta yaratiladi
// (seed qayta ishlaydigan — deterministik kalitlar; bitta jarayonda bir vaqtda faqat bitta seed).
let seeding: Promise<void> | null = null;

export function ensureDemoData(): Promise<void> {
  seeding ??= (async () => {
    const operator = await prisma.user.findUnique({ where: { login: "operator" }, select: { id: true } });
    if (operator) return;
    console.log("[ecopoint] Ochiq kirish: baza bo‘sh — demo ma’lumotlar yaratilmoqda…");
    await runSeed({ allowProduction: true, log: (m) => console.log(`[ecopoint] ${m}`) });
    console.log("[ecopoint] Demo ma’lumotlar tayyor.");
  })().catch((e) => {
    seeding = null; // keyingi urinishda qayta sinab ko‘riladi
    throw e;
  });
  return seeding;
}

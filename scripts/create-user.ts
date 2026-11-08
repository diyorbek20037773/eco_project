// Haqiqiy (demo bo'lmagan) pilot foydalanuvchisini yaratish. Production'da ham ishlaydi.
// Foydalanish:
//   npm run user:create -- --role OPERATOR --login ali --name "Ali Valiyev" [--phone "+998 90 ..."] [--shop-id <id>] [--password <parol>]
// Parol --password yoki NEW_USER_PASSWORD muhit o'zgaruvchisidan olinadi (kamida 10 belgi).
// PowerShell: $env:NEW_USER_PASSWORD = "uzun-maxfiy-parol"; npm run user:create -- --role SHOP --login nur2 --name "Nur xodimi" --shop-id <id>
import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma } from "@/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const ROLES = ["SHOP", "COLLECTOR", "OPERATOR"] as const;
type Role = (typeof ROLES)[number];

function fail(msg: string): never {
  console.error(`Xato: ${msg}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      role: { type: "string" },
      login: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
      "shop-id": { type: "string" },
      password: { type: "string" },
    },
    strict: true,
  });

  const role = (values.role ?? "").toUpperCase() as Role;
  if (!ROLES.includes(role)) fail("--role SHOP | COLLECTOR | OPERATOR bo‘lishi kerak.");
  const login = (values.login ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) fail("--login 3–32 belgi: lotin harflari, raqam, nuqta, chiziqcha.");
  const name = (values.name ?? "").trim();
  if (name.length < 2) fail("--name kiriting (masalan \"Ali Valiyev\").");
  const password = values.password ?? process.env.NEW_USER_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) fail(`Parol kamida ${MIN_PASSWORD_LENGTH} belgi bo‘lsin (--password yoki NEW_USER_PASSWORD).`);
  if (password === "EcoDemo2026!") fail("Demo parolni haqiqiy akkauntga qo‘yib bo‘lmaydi.");

  const shopId = values["shop-id"]?.trim() || null;
  if (role === "SHOP") {
    if (!shopId) {
      const shops = await prisma.shop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
      console.error("Do‘kon xodimi uchun --shop-id kerak. Mavjud do‘konlar:");
      for (const s of shops) console.error(`  ${s.id}  ${s.name}`);
      fail("--shop-id ko‘rsatilmagan.");
    }
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) fail(`Do‘kon topilmadi: ${shopId}`);
  } else if (shopId) {
    fail("--shop-id faqat SHOP roli uchun.");
  }

  const exists = await prisma.user.findUnique({ where: { login } });
  if (exists) fail(`"${login}" login band.`);

  const user = await prisma.user.create({
    data: { login, name, role, phone: values.phone?.trim() || null, shopId, passwordHash: await hashPassword(password), isDemo: false },
  });
  await prisma.auditEvent.create({
    data: { actorId: null, action: "USER_CREATED", entityType: "User", entityId: user.id, after: { login, role, shopId, via: "cli" } },
  });
  console.log(`Foydalanuvchi yaratildi: ${login} (${role})${shopId ? `, do‘kon ${shopId}` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

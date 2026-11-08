// Operator katalogi: do'kon, nuqta, do'kon xodimi, yig'uvchi, xaridor, tarif.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { ActionResult } from "@/server/contract";
import { duplicate, fieldError, notFound } from "@/domain/errors";
import { parseKgToGrams } from "@/domain/weight";
import { audit, isUniqueViolation, ok, okEmpty, parseInput, requireRole, run, withTx, zId, zLogin, zOptText, zPhone, zRequiredText, zSom, type Actor, type Tx } from "./core";

const zPassword = z
  .string({ error: "Parolni kiriting." })
  .min(MIN_PASSWORD_LENGTH, `Parol kamida ${MIN_PASSWORD_LENGTH} belgi bo‘lsin.`)
  .max(200, "Parol juda uzun.");
const zName = (msg: string) => zRequiredText(2, 120, msg);
const zOptPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(zPhone.optional());

const pointShape = {
  name: zName("Nuqta nomini yozing."),
  address: zRequiredText(3, 200, "Manzilni yozing."),
  district: zRequiredText(2, 80, "Hududni (mahalla/tuman) yozing."),
  landmark: zOptText(200, "Mo‘ljal"),
  contactName: zOptText(120, "Kontakt ismi"),
  contactPhone: zPhone,
};

const userShape = { login: zLogin, name: zName("Ismni yozing."), password: zPassword };

function loginTaken(): never {
  throw duplicate("Bu login band. Boshqa login tanlang.", { login: "Bu login band." });
}

async function createUserTx(tx: Tx, data: { login: string; name: string; password: string; role: "SHOP" | "COLLECTOR" | "OPERATOR"; shopId?: string; phone?: string }) {
  const exists = await tx.user.findUnique({ where: { login: data.login }, select: { id: true } });
  if (exists) loginTaken();
  return tx.user.create({
    data: {
      login: data.login,
      name: data.name,
      role: data.role,
      shopId: data.shopId ?? null,
      phone: data.phone ?? null,
      passwordHash: await hashPassword(data.password),
      isDemo: false,
    },
  });
}

async function guardUnique<T>(fn: () => Promise<T>, onDup: () => never): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isUniqueViolation(e)) onDup();
    throw e;
  }
}

// ---------------------------------------------------------------------------
const shopSchema = z.object({
  name: zName("Do‘kon nomini yozing."),
  contactName: zOptText(120, "Kontakt ismi"),
  phone: zOptPhone,
  point: z.object(pointShape),
  user: z.object(userShape).optional(),
});

export async function createShop(actorIn: Actor | null, raw: z.input<typeof shopSchema>): Promise<ActionResult<{ shopId: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(shopSchema, raw);
    const shopId = await guardUnique(
      () =>
        withTx(async (tx) => {
          const shop = await tx.shop.create({ data: { name: input.name, contactName: input.contactName ?? null, phone: input.phone ?? null } });
          const point = await tx.point.create({
            data: {
              shopId: shop.id,
              name: input.point.name,
              address: input.point.address,
              district: input.point.district,
              landmark: input.point.landmark ?? null,
              contactName: input.point.contactName ?? null,
              contactPhone: input.point.contactPhone,
            },
          });
          let userId: string | null = null;
          if (input.user) userId = (await createUserTx(tx, { ...input.user, role: "SHOP", shopId: shop.id })).id;
          await audit(tx, {
            actorId: actor.id,
            action: "SHOP_CREATED",
            entityType: "Shop",
            entityId: shop.id,
            after: { name: shop.name, pointId: point.id, district: point.district, userLogin: input.user?.login ?? null, userId },
          });
          return shop.id;
        }),
      loginTaken,
    );
    return ok({ shopId }, { message: "Do‘kon qo‘shildi." });
  });
}

const pointSchema = z.object({ shopId: zId, ...pointShape });

export async function addPoint(actorIn: Actor | null, raw: z.input<typeof pointSchema>): Promise<ActionResult<{ pointId: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(pointSchema, raw);
    const shop = await prisma.shop.findUnique({ where: { id: input.shopId } });
    if (!shop) throw notFound();
    const pointId = await guardUnique(
      () =>
        withTx(async (tx) => {
          const p = await tx.point.create({
            data: {
              shopId: shop.id,
              name: input.name,
              address: input.address,
              district: input.district,
              landmark: input.landmark ?? null,
              contactName: input.contactName ?? null,
              contactPhone: input.contactPhone,
            },
          });
          await audit(tx, { actorId: actor.id, action: "POINT_CREATED", entityType: "Point", entityId: p.id, after: { shopId: shop.id, name: p.name, address: p.address, district: p.district } });
          return p.id;
        }),
      () => {
        throw duplicate("Bu do‘konda shu nomli nuqta bor.", { name: "Bu nom band." });
      },
    );
    return ok({ pointId }, { message: "Nuqta qo‘shildi." });
  });
}

const shopUserSchema = z.object({ shopId: zId, ...userShape });

export async function addShopUser(actorIn: Actor | null, raw: z.input<typeof shopUserSchema>): Promise<ActionResult<{ userId: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(shopUserSchema, raw);
    const shop = await prisma.shop.findUnique({ where: { id: input.shopId } });
    if (!shop) throw notFound();
    const userId = await guardUnique(
      () =>
        withTx(async (tx) => {
          const u = await createUserTx(tx, { login: input.login, name: input.name, password: input.password, role: "SHOP", shopId: shop.id });
          await audit(tx, { actorId: actor.id, action: "USER_CREATED", entityType: "User", entityId: u.id, after: { login: u.login, role: u.role, shopId: shop.id } });
          return u.id;
        }),
      loginTaken,
    );
    return ok({ userId }, { message: "Xodim qo‘shildi." });
  });
}

const collectorSchema = z.object({ name: zName("Ismni yozing."), phone: zPhone, login: zLogin, password: zPassword });

export async function createCollector(actorIn: Actor | null, raw: z.input<typeof collectorSchema>): Promise<ActionResult<{ userId: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(collectorSchema, raw);
    const userId = await guardUnique(
      () =>
        withTx(async (tx) => {
          const u = await createUserTx(tx, { login: input.login, name: input.name, password: input.password, role: "COLLECTOR", phone: input.phone });
          await audit(tx, { actorId: actor.id, action: "USER_CREATED", entityType: "User", entityId: u.id, after: { login: u.login, role: u.role, phone: u.phone } });
          return u.id;
        }),
      loginTaken,
    );
    return ok({ userId }, { message: "Yig‘uvchi qo‘shildi." });
  });
}

// ---------------------------------------------------------------------------
function parseMinBatch(v: string): number {
  const t = v.trim();
  if (t === "") return 0;
  const g = parseKgToGrams(t);
  if (g === null) throw fieldError("minBatchKg", "Minimal partiyani kg’da kiriting, masalan 300.");
  return g;
}

const buyerSchema = z.object({
  name: zName("Xaridor nomini yozing."),
  contactName: zOptText(120, "Kontakt ismi"),
  phone: zOptPhone,
  address: zOptText(200, "Manzil"),
  qualityTerms: zRequiredText(3, 1000, "Sifat shartlarini yozing."),
  minBatchKg: z.string().max(20),
});

export async function createBuyer(actorIn: Actor | null, raw: z.input<typeof buyerSchema>): Promise<ActionResult<{ buyerId: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(buyerSchema, raw);
    const minBatchGrams = parseMinBatch(input.minBatchKg);
    const buyerId = await guardUnique(
      () =>
        withTx(async (tx) => {
          const b = await tx.buyer.create({
            data: { name: input.name, contactName: input.contactName ?? null, phone: input.phone ?? null, address: input.address ?? null, qualityTerms: input.qualityTerms, minBatchGrams },
          });
          await audit(tx, { actorId: actor.id, action: "BUYER_CREATED", entityType: "Buyer", entityId: b.id, after: { name: b.name, minBatchGrams } });
          return b.id;
        }),
      () => {
        throw duplicate("Bu nomli xaridor bor.", { name: "Bu nom band." });
      },
    );
    return ok({ buyerId }, { message: "Xaridor qo‘shildi." });
  });
}

const updateBuyerSchema = z.object({
  buyerId: zId,
  contactName: zOptText(120, "Kontakt ismi"),
  phone: zOptPhone,
  address: zOptText(200, "Manzil"),
  qualityTerms: zRequiredText(3, 1000, "Sifat shartlarini yozing."),
  minBatchKg: z.string().max(20),
  isActive: z.boolean(),
});

export async function updateBuyer(actorIn: Actor | null, raw: z.input<typeof updateBuyerSchema>): Promise<ActionResult> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(updateBuyerSchema, raw);
    const minBatchGrams = parseMinBatch(input.minBatchKg);
    const b = await prisma.buyer.findUnique({ where: { id: input.buyerId } });
    if (!b) throw notFound();
    await withTx(async (tx) => {
      const after = {
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        qualityTerms: input.qualityTerms,
        minBatchGrams,
        isActive: input.isActive,
      };
      await tx.buyer.update({ where: { id: b.id }, data: after });
      await audit(tx, {
        actorId: actor.id,
        action: "BUYER_UPDATED",
        entityType: "Buyer",
        entityId: b.id,
        before: { contactName: b.contactName, phone: b.phone, address: b.address, qualityTerms: b.qualityTerms, minBatchGrams: b.minBatchGrams, isActive: b.isActive },
        after,
      });
    });
    return okEmpty({ message: "Xaridor ma’lumoti saqlandi." });
  });
}

// ---------------------------------------------------------------------------
const tariffSchema = z.object({
  shopPricePerKg: zSom("Do‘kon narxi"),
  buyerPricePerKg: zSom("Xaridor narxi"),
  serviceFee: zSom("Xizmat haqi"),
  note: zOptText(300, "Izoh"),
});

/** Yangi tarif hozirdan amal qiladi. Mavjud reyslar o'z narx nusxasini saqlaydi. */
export async function createTariff(actorIn: Actor | null, raw: z.input<typeof tariffSchema>): Promise<ActionResult<{ tariffId: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "OPERATOR");
    const input = parseInput(tariffSchema, raw);
    const tariffId = await withTx(async (tx) => {
      const t = await tx.tariff.create({
        data: { shopPricePerKg: input.shopPricePerKg, buyerPricePerKg: input.buyerPricePerKg, serviceFee: input.serviceFee, note: input.note ?? null, validFrom: new Date(), createdById: actor.id },
      });
      await audit(tx, { actorId: actor.id, action: "TARIFF_CREATED", entityType: "Tariff", entityId: t.id, after: { shopPricePerKg: t.shopPricePerKg, buyerPricePerKg: t.buyerPricePerKg, serviceFee: t.serviceFee } });
      return t.id;
    });
    return ok({ tariffId }, { message: "Yangi tarif saqlandi. Yangi reyslarga qo‘llanadi." });
  });
}

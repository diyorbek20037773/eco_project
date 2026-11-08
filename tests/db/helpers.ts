// DB testlari uchun fixture'lar. Har test o'z noyob ma'lumotini yaratadi (prefiks bilan).
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { ActionResult } from "@/server/contract";
import { tashkentToday } from "@/domain/time";
import type { Actor } from "@/server/services/core";
import { confirmStopWeight, createPickupRequest } from "@/server/services/shop";
import { recordWeighing } from "@/server/services/collector";
import { createTrip, recordAcceptance, addExpense } from "@/server/services/trips";

let pwHash: Promise<string> | null = null;
const hash = () => (pwHash ??= hashPassword("TestParol123!"));

export const key = () => randomUUID();
export const today = () => tashkentToday();

export function okData<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`Kutilgan ok, olindi ${r.code}: ${r.error}`);
  return r.data;
}

export function expectError(r: ActionResult<unknown>, code: string) {
  expect(r.ok, r.ok ? "ok qaytdi" : r.error).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

async function makeUser(login: string, role: Actor["role"], shopId: string | null = null, extra: { isDemo?: boolean; isActive?: boolean } = {}): Promise<Actor> {
  const u = await prisma.user.create({
    data: { login, name: login, role, shopId, passwordHash: await hash(), phone: "+998 90 111 22 33", isDemo: extra.isDemo ?? false, isActive: extra.isActive ?? true },
  });
  return { id: u.id, role: u.role, shopId: u.shopId, name: u.name };
}

export interface World {
  operator: Actor;
  shops: { actor: Actor; shopId: string; pointId: string }[];
  collector: Actor;
  collector2: Actor;
  buyerId: string;
  tariffId: string;
}

/** 3 do'kon (har birida 1 nuqta), 2 yig'uvchi, operator, xaridor, tarif. */
export async function makeWorld(): Promise<World> {
  const p = `t${randomUUID().slice(0, 8)}`;
  const operator = await makeUser(`${p}-op`, "OPERATOR");
  const shops: World["shops"] = [];
  for (let i = 1; i <= 3; i++) {
    const shop = await prisma.shop.create({ data: { name: `${p} do‘kon ${i}` } });
    const point = await prisma.point.create({
      data: { shopId: shop.id, name: `Nuqta ${i}`, address: `Test ko‘chasi ${i} (shartli)`, district: i === 3 ? "Qarshi-2" : "Markaz", contactPhone: "+998 90 000 00 00" },
    });
    shops.push({ actor: await makeUser(`${p}-shop${i}`, "SHOP", shop.id), shopId: shop.id, pointId: point.id });
  }
  const collector = await makeUser(`${p}-col1`, "COLLECTOR");
  const collector2 = await makeUser(`${p}-col2`, "COLLECTOR");
  const buyer = await prisma.buyer.create({ data: { name: `${p} xaridor`, qualityTerms: "Toza karton", minBatchGrams: 300_000 } });
  const tariff = await prisma.tariff.create({ data: { shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000, validFrom: new Date() } }); // eng yangi — shu fayl uchun joriy tarif
  return { operator, shops, collector, collector2, buyerId: buyer.id, tariffId: tariff.id };
}

export async function newRequest(w: World, shopIndex: number, extra: Partial<{ estimatedKg: string }> = {}): Promise<string> {
  const s = w.shops[shopIndex]!;
  return okData(
    await createPickupRequest(s.actor, { clientKey: key(), pointId: s.pointId, readyDate: today(), fromTime: "00:00", toTime: "23:59", estimatedKg: extra.estimatedKg ?? "50" }),
  ).requestId;
}

export async function newTrip(w: World, requestIds: string[], prices = { shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000 }, collector?: Actor) {
  return okData(
    await createTrip(w.operator, {
      clientKey: key(),
      requestIds,
      collectorId: (collector ?? w.collector).id,
      buyerId: w.buyerId,
      date: today(),
      fromTime: "09:00",
      toTime: "18:00",
      ...prices,
    }),
  ).tripId;
}

export async function stopsOf(tripId: string) {
  return prisma.tripStop.findMany({ where: { tripId, status: { not: "REMOVED" } }, orderBy: { sequence: "asc" } });
}

/** 3 bekatli reys: tortiladi (gross/tare), hammasi tasdiqlanadi. */
export async function collectedTrip(w: World, kg: [string, string][] = [["185", "5"], ["162,5", "2,5"], ["161", "1"]], opts: { confirm?: boolean } = {}) {
  const requestIds: string[] = [];
  for (let i = 0; i < kg.length; i++) requestIds.push(await newRequest(w, i % w.shops.length));
  const tripId = await newTrip(w, requestIds);
  const stops = await stopsOf(tripId);
  for (const [i, s] of stops.entries()) {
    const [gross, tare] = kg[i]!;
    okData(await recordWeighing(w.collector, { stopId: s.id, clientKey: key(), grossKg: gross, tareKg: tare }));
    if (opts.confirm !== false) okData(await confirmStopWeight(w.shops[i % w.shops.length]!.actor, { stopId: s.id }));
  }
  return { tripId, stops, requestIds };
}

export async function accept(w: World, tripId: string, acceptedKg: string, discrepancy = true) {
  return recordAcceptance(w.operator, {
    tripId,
    clientKey: key(),
    acceptedKg,
    quality: "GOOD",
    buyerPricePerKg: 1500,
    buyerReference: "Nakladnoy T-1",
    acceptedDate: today(),
    acceptedTime: "00:01",
    ...(discrepancy ? { discrepancyReason: "Namlik ajratildi", decision: "TRIP_ABSORBS" as const } : {}),
  });
}

export async function transport(w: World, tripId: string, amount = 300_000) {
  return okData(await addExpense(w.operator, { tripId, clientKey: key(), type: "TRANSPORT", amount, payer: "COLLECTOR" }));
}

export async function obligationsOf(tripId: string) {
  const rows = await prisma.obligation.findMany({ where: { tripId }, include: { payments: true } });
  return Object.fromEntries(rows.map((o) => [o.key, o]));
}

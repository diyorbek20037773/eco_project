// Mahalliy demo seed — qayta ishlaydigan (upsert + deterministik clientKey).
// Barcha manzil, narx va nomlar SHARTLI. Haqiqiy mijoz/shartnoma/to'lov ma'lumoti yo'q.
// Production'da (NODE_ENV=production) ishlamaydi: haqiqiy foydalanuvchini `npm run user:create` bilan yarating.
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { ActionResult } from "@/server/contract";
import { addDays, tashkentToUtc, tashkentToday } from "@/domain/time";
import { DEMO_PASSWORD, DEMO_USERS } from "@/server/demo";
import type { Actor } from "@/server/services/core";
import { createPickupRequest, confirmStopWeight } from "@/server/services/shop";
import { recordWeighing } from "@/server/services/collector";
import { addExpense, closeTrip, createTrip, recordAcceptance, recordPayment } from "@/server/services/trips";

type ShopKey = "dokon1" | "dokon2" | "dokon3";

const SHOPS: Record<ShopKey, { id: string; name: string; contactName: string; phone: string }> = {
  dokon1: { id: "seed-shop-nur", name: "Nur market", contactName: "Dilnoza", phone: "+998 90 000 00 11" },
  dokon2: { id: "seed-shop-bahor", name: "Bahor savdo", contactName: "Sardor", phone: "+998 90 000 00 12" },
  dokon3: { id: "seed-shop-oila", name: "Oila supermarketi", contactName: "Malika", phone: "+998 90 000 00 13" },
};

const POINTS = [
  { id: "seed-point-nur-markaz", shop: "dokon1", name: "Nur market — Markaz", address: "I. Karimov ko‘chasi 12 (shartli)", district: "Markaz", landmark: "Markaziy bozor yonida (shartli)", contactName: "Dilnoza", contactPhone: "+998 90 000 00 11" },
  { id: "seed-point-nur-nasaf", shop: "dokon1", name: "Nur market — Nasaf", address: "Nasaf ko‘chasi 45 (shartli)", district: "Nasaf", landmark: "Avtobus bekati qarshisida (shartli)", contactName: "Jasur", contactPhone: "+998 90 000 00 14" },
  { id: "seed-point-bahor", shop: "dokon2", name: "Bahor savdo", address: "Mustaqillik shoh ko‘chasi 7 (shartli)", district: "Markaz", landmark: null, contactName: "Sardor", contactPhone: "+998 90 000 00 12" },
  { id: "seed-point-oila", shop: "dokon3", name: "Oila supermarketi", address: "Qarshi-2 mavzesi, 3-uy (shartli)", district: "Qarshi-2", landmark: "Maktab yonida (shartli)", contactName: "Malika", contactPhone: "+998 90 000 00 13" },
] as const satisfies readonly { id: string; shop: ShopKey; name: string; address: string; district: string; landmark: string | null; contactName: string; contactPhone: string }[];

const BUYER = {
  name: "Qarshi qog‘oz qayta ishlash (shartli)",
  contactName: "Qabul bo‘limi (shartli)",
  phone: "+998 90 000 00 31",
  address: "Sanoat zonasi, 1-ko‘cha (shartli)",
  qualityTerms: "Quruq, toza karton; yog‘, plyonka va skotch aralashmasi 5% dan oshmasin (shartli).",
  minBatchGrams: 300_000,
};

const TARIFF = { id: "seed-tariff-base", shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000, validFrom: new Date("2026-01-01T00:00:00+05:00"), note: "Demo tarif (shartli)" };

function must<T>(r: ActionResult<T>, label: string): T {
  if (!r.ok) throw new Error(`Seed: ${label} — ${r.code}: ${r.error}`);
  return r.data;
}

export interface SeedSummary {
  users: number;
  shops: number;
  points: number;
  sampleTripId: string;
  todayRequestIds: string[];
}

export async function runSeed(opts: { log?: (msg: string) => void; now?: Date } = {}): Promise<SeedSummary> {
  const log = opts.log ?? (() => {});
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed production rejimida ishlamaydi. Haqiqiy foydalanuvchi uchun: npm run user:create -- --role OPERATOR --login ... --name ...");
  }

  // 1. Do'konlar va nuqtalar
  for (const s of Object.values(SHOPS)) {
    await prisma.shop.upsert({ where: { id: s.id }, update: { name: s.name, contactName: s.contactName, phone: s.phone, isActive: true }, create: s });
  }
  for (const p of POINTS) {
    const data = { name: p.name, address: p.address, district: p.district, landmark: p.landmark, contactName: p.contactName, contactPhone: p.contactPhone, isActive: true };
    await prisma.point.upsert({ where: { id: p.id }, update: data, create: { id: p.id, shopId: SHOPS[p.shop].id, ...data } });
  }

  // 2. Xaridor va tarif
  const buyer = await prisma.buyer.upsert({ where: { name: BUYER.name }, update: {}, create: BUYER });
  await prisma.tariff.upsert({ where: { id: TARIFF.id }, update: {}, create: TARIFF });

  // 3. Demo foydalanuvchilar
  const actors = new Map<string, Actor>();
  for (const u of DEMO_USERS) {
    const shopId = u.shopKey ? SHOPS[u.shopKey].id : null;
    const existing = await prisma.user.findUnique({ where: { login: u.login } });
    const passwordOk = existing ? await verifyPassword(DEMO_PASSWORD, existing.passwordHash) : false;
    const user = await prisma.user.upsert({
      where: { login: u.login },
      update: { name: u.name, role: u.role, phone: u.phone, shopId, isDemo: true, isActive: true, ...(passwordOk ? {} : { passwordHash: await hashPassword(DEMO_PASSWORD) }) },
      create: { login: u.login, name: u.name, role: u.role, phone: u.phone, shopId, isDemo: true, passwordHash: await hashPassword(DEMO_PASSWORD) },
    });
    actors.set(u.login, { id: user.id, role: user.role, shopId: user.shopId, name: user.name });
  }
  const actor = (login: string): Actor => {
    const a = actors.get(login);
    if (!a) throw new Error(`Seed: ${login} topilmadi`);
    return a;
  };
  const operator = actor("operator");
  const collector = actor("yiguvchi1");

  // 4. Kechagi namunaviy reys: 180 + 160 + 160 kg → xaridor 470 kg qabul qilgan
  const today = tashkentToday(opts.now);
  const yesterday = addDays(today, -1);
  const sample = [
    { key: "seed-sample-req-1", login: "dokon1", pointId: "seed-point-nur-markaz", gross: "185", tare: "5", est: 170_000 },
    { key: "seed-sample-req-2", login: "dokon2", pointId: "seed-point-bahor", gross: "162,5", tare: "2,5", est: 150_000 },
    { key: "seed-sample-req-3", login: "dokon3", pointId: "seed-point-oila", gross: "161", tare: "1", est: 160_000 },
  ];
  let sampleTrip = await prisma.trip.findUnique({ where: { clientKey: "seed-sample-trip" } });
  const freshSample = !sampleTrip;
  const requestIds: string[] = [];
  if (freshSample) {
    for (const s of sample) {
      const a = actor(s.login);
      const r = await prisma.pickupRequest.upsert({
        where: { clientKey: s.key },
        update: {},
        create: {
          clientKey: s.key,
          shopId: a.shopId!,
          pointId: s.pointId,
          createdById: a.id,
          readyFrom: tashkentToUtc(yesterday, "09:00")!,
          readyTo: tashkentToUtc(yesterday, "12:00")!,
          estimatedGrams: s.est,
          note: "Namunaviy buyurtma (shartli)",
          createdAt: tashkentToUtc(yesterday, "08:00")!,
        },
      });
      requestIds.push(r.id);
    }
  }
  const tripRes = must(
    await createTrip(operator, {
      clientKey: "seed-sample-trip",
      requestIds: requestIds.length ? requestIds : ["seed-placeholder"],
      collectorId: collector.id,
      buyerId: buyer.id,
      date: yesterday,
      fromTime: "10:00",
      toTime: "13:00",
      shopPricePerKg: TARIFF.shopPricePerKg,
      buyerPricePerKg: TARIFF.buyerPricePerKg,
      serviceFee: TARIFF.serviceFee,
      vehicle: "Damas, 01 A 000 AA (shartli)",
      note: "Namunaviy reys (shartli)",
    }),
    "reys",
  );
  sampleTrip = await prisma.trip.findUniqueOrThrow({ where: { id: tripRes.tripId } });
  const stops = await prisma.tripStop.findMany({ where: { tripId: sampleTrip.id }, orderBy: { sequence: "asc" }, include: { request: true } });

  for (const [i, stop] of stops.entries()) {
    const s = sample.find((x) => x.key === stop.request.clientKey) ?? sample[i]!;
    must(await recordWeighing(collector, { stopId: stop.id, clientKey: `seed-sample-w-${i + 1}`, grossKg: s.gross, tareKg: s.tare }), "tortish");
    must(await confirmStopWeight(actor(s.login), { stopId: stop.id }), "tasdiq");
  }
  // Vaqtlarni kechaga moslash (faqat ko'rinish uchun, faqat birinchi yaratishda).
  for (const [i, stop] of freshSample ? [...stops.entries()] : []) {
    const at = tashkentToUtc(yesterday, `${String(10 + i).padStart(2, "0")}:30`)!;
    await prisma.tripStop.update({ where: { id: stop.id }, data: { collectedAt: at } });
    await prisma.weighing.updateMany({ where: { stopId: stop.id }, data: { recordedAt: at } });
    await prisma.shopConfirmation.updateMany({ where: { stopId: stop.id }, data: { createdAt: new Date(at.getTime() + 60 * 60 * 1000) } });
  }

  must(
    await recordAcceptance(operator, {
      tripId: sampleTrip.id,
      clientKey: "seed-sample-acc",
      acceptedKg: "470",
      quality: "ACCEPTABLE",
      qualityNote: "Bir qismi nam (shartli)",
      discrepancyReason: "Nam va ifloslangan karton xaridor tomonidan ajratildi (shartli)",
      decision: "TRIP_ABSORBS",
      buyerPricePerKg: TARIFF.buyerPricePerKg,
      buyerReference: "Nakladnoy DEMO-001 (shartli)",
      acceptedDate: yesterday,
      acceptedTime: "16:00",
    }),
    "qabul",
  );
  must(
    await addExpense(operator, { tripId: sampleTrip.id, clientKey: "seed-sample-exp", type: "TRANSPORT", amount: 300_000, payer: "COLLECTOR", recipient: "Yuk tashuvchi (shartli)", note: "Transport (shartli)" }),
    "xarajat",
  );

  const obligations = await prisma.obligation.findMany({ where: { tripId: sampleTrip.id } });
  const ob = (key: string) => {
    const o = obligations.find((x) => x.key === key);
    if (!o) throw new Error(`Seed: majburiyat ${key} topilmadi`);
    return o;
  };
  const payments: { key: string; obKey: string; amount: number }[] = [
    { key: "seed-sample-pay-buyer", obKey: "BUYER_MATERIAL", amount: 705_000 },
    { key: "seed-sample-pay-shop1", obKey: `SHOP_PAYOUT:${stops[0]!.id}`, amount: 144_000 },
    { key: "seed-sample-pay-shop2", obKey: `SHOP_PAYOUT:${stops[1]!.id}`, amount: 64_000 },
    { key: "seed-sample-pay-fee", obKey: "SERVICE_FEE", amount: 1_000 },
  ];
  for (const p of payments) {
    must(
      await recordPayment(operator, { obligationId: ob(p.obKey).id, clientKey: p.key, amount: p.amount, paidDate: yesterday, method: "Naqd (shartli)", reference: "Demo to‘lov (shartli)" }),
      `to‘lov ${p.obKey}`,
    );
  }
  const closed = must(await closeTrip(operator, { tripId: sampleTrip.id }), "yopish");

  // 5. Bugungi 3 ta yangi buyurtma
  const todayReqs = [
    { n: 1, login: "dokon1", pointId: "seed-point-nur-nasaf", from: "14:00", to: "16:00", kg: "45", volume: undefined, note: "Orqa eshikdan olib keting (shartli)" },
    { n: 2, login: "dokon3", pointId: "seed-point-oila", from: "15:00", to: "17:00", kg: undefined, volume: "LARGE" as const, note: "Tarozi yo‘q, taxminan katta hajm" },
    { n: 3, login: "dokon2", pointId: "seed-point-bahor", from: "16:00", to: "18:00", kg: "30", volume: undefined, note: undefined },
  ];
  const todayRequestIds: string[] = [];
  for (const r of todayReqs) {
    const res = must(
      await createPickupRequest(actor(r.login), {
        clientKey: `seed-today-${today}-${r.n}`,
        pointId: r.pointId,
        readyDate: today,
        fromTime: r.from,
        toTime: r.to,
        estimatedKg: r.kg,
        volume: r.volume,
        note: r.note,
      }),
      "bugungi buyurtma",
    );
    todayRequestIds.push(res.requestId);
  }

  log(`Namunaviy reys #${sampleTrip.number}: ${closed.status} (180 + 160 + 160 kg → 470 kg qabul)`);
  log(`Bugungi yangi buyurtmalar: ${todayRequestIds.length} ta (${today})`);
  return {
    users: DEMO_USERS.length,
    shops: Object.keys(SHOPS).length,
    points: POINTS.length,
    sampleTripId: sampleTrip.id,
    todayRequestIds,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Demo seed production rejimida ishlamaydi (NODE_ENV=production).");
    console.error("Haqiqiy foydalanuvchi: npm run user:create -- --role OPERATOR --login ali --name \"Ali Valiyev\"");
    process.exit(1);
  }
  await runSeed({ log: (m) => console.log(m) });
  console.log("\nDemo akkauntlar (barcha ma’lumotlar shartli; parol hammasi uchun bir xil):");
  for (const u of DEMO_USERS) console.log(`  ${u.login.padEnd(10)} ${DEMO_PASSWORD}   ${u.label}`);
  console.log("\nSeed tugadi. Qayta ishga tushirish dublikat yaratmaydi.");
}

const isMain = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

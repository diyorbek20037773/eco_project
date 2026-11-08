// Idempotentlik, parallel ishlash, yo'l qo'yilmagan o'tishlar, qoldirish va bahs.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { recordWeighing, skipStop } from "@/server/services/collector";
import { acknowledgeDispute, cancelPickupRequest, confirmStopWeight, disputeStopWeight } from "@/server/services/shop";
import { closeTrip, decideDispute, recordPayment, cancelTrip, reorderTripStops } from "@/server/services/trips";
import { loadQueue } from "@/server/loaders/operator";
import { loadSettlement } from "@/server/services/obligations";
import { accept, collectedTrip, expectError, key, makeWorld, newRequest, newTrip, obligationsOf, okData, stopsOf, today, type World } from "./helpers";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});

describe("idempotentlik", () => {
  it("bir clientKey bilan ikki marta tortish → bitta yozuv, replayed", async () => {
    const req = await newRequest(w, 0);
    const tripId = await newTrip(w, [req]);
    const [stop] = await stopsOf(tripId);
    const ck = key();
    const a = await recordWeighing(w.collector, { stopId: stop!.id, clientKey: ck, grossKg: "50", tareKg: "1" });
    const b = await recordWeighing(w.collector, { stopId: stop!.id, clientKey: ck, grossKg: "50", tareKg: "1" });
    expect(okData(a).netGrams).toBe(49_000);
    expect(b.ok && b.replayed).toBe(true);
    expect(await prisma.weighing.count({ where: { stopId: stop!.id } })).toBe(1);
    // boshqa clientKey bilan qayta tortish — rad
    expectError(await recordWeighing(w.collector, { stopId: stop!.id, clientKey: key(), grossKg: "60", tareKg: "0" }), "INVALID_TRANSITION");
  });

  it("parallel bir xil clientKey bilan tortish → bitta yozuv", async () => {
    const req = await newRequest(w, 1);
    const tripId = await newTrip(w, [req]);
    const [stop] = await stopsOf(tripId);
    const ck = key();
    const rs = await Promise.all([1, 2, 3].map(() => recordWeighing(w.collector, { stopId: stop!.id, clientKey: ck, grossKg: "40", tareKg: "" })));
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(await prisma.weighing.count({ where: { stopId: stop!.id } })).toBe(1);
  });

  it("noto‘g‘ri vazn: ortiqcha tara, manfiy, 0 sof — rad", async () => {
    const req = await newRequest(w, 2);
    const tripId = await newTrip(w, [req]);
    const [stop] = await stopsOf(tripId);
    for (const [g, t] of [["10", "12"], ["-5", "0"], ["10", "10"], ["", "0"], ["abc", "1"]] as const) {
      expectError(await recordWeighing(w.collector, { stopId: stop!.id, clientKey: key(), grossKg: g, tareKg: t }), "VALIDATION");
    }
    expect(await prisma.weighing.count({ where: { stopId: stop!.id } })).toBe(0);
  });

  it("takroriy to‘lov clientKey → bitta yozuv; ortiqcha to‘lov → OVERPAYMENT", async () => {
    const { tripId } = await collectedTrip(w);
    okData(await accept(w, tripId, "470"));
    const ob = await obligationsOf(tripId);
    const buyer = ob.BUYER_MATERIAL!;
    const ck = key();
    const p1 = await recordPayment(w.operator, { obligationId: buyer.id, clientKey: ck, amount: 100_000, paidDate: today() });
    const p2 = await recordPayment(w.operator, { obligationId: buyer.id, clientKey: ck, amount: 100_000, paidDate: today() });
    expect(okData(p1).remaining).toBe(605_000);
    expect(p2.ok && p2.replayed).toBe(true);
    expect(await prisma.payment.count({ where: { obligationId: buyer.id } })).toBe(1);
    expectError(await recordPayment(w.operator, { obligationId: buyer.id, clientKey: key(), amount: 605_001, paidDate: today() }), "OVERPAYMENT");
    expectError(await recordPayment(w.operator, { obligationId: buyer.id, clientKey: key(), amount: 0, paidDate: today() }), "VALIDATION");
  });

  it("parallel 2 ta to‘lov qoldiqdan oshmaydi", async () => {
    const { tripId, stops } = await collectedTrip(w);
    okData(await accept(w, tripId, "470"));
    const ob = (await obligationsOf(tripId))[`SHOP_PAYOUT:${stops[1]!.id}`]!; // 128 000
    const rs = await Promise.all([
      recordPayment(w.operator, { obligationId: ob.id, clientKey: key(), amount: 100_000, paidDate: today() }),
      recordPayment(w.operator, { obligationId: ob.id, clientKey: key(), amount: 100_000, paidDate: today() }),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    const failed = rs.find((r) => !r.ok);
    expect(failed && !failed.ok && failed.code).toBe("OVERPAYMENT");
    const sum = await prisma.payment.aggregate({ where: { obligationId: ob.id }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(100_000);
  });

  it("bitta buyurtmani ikki reysga parallel qo‘shish — bittasi rad", async () => {
    const req = await newRequest(w, 0);
    const mk = () =>
      import("@/server/services/trips").then(({ createTrip }) =>
        createTrip(w.operator, { clientKey: key(), requestIds: [req], collectorId: w.collector.id, buyerId: w.buyerId, date: today(), fromTime: "09:00", toTime: "12:00", shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000 }),
      );
    const rs = await Promise.all([mk(), mk()]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    const bad = rs.find((r) => !r.ok);
    expect(bad && !bad.ok && ["INVALID_TRANSITION", "CONFLICT"].includes(bad.code)).toBe(true);
    expect(await prisma.tripStop.count({ where: { requestId: req, activeRequestKey: { not: null } } })).toBe(1);
    expect(await prisma.trip.count({ where: { stops: { some: { requestId: req } } } })).toBe(1);
  });
});

describe("yo‘l qo‘yilmagan holat o‘tishlari", () => {
  it("qabulsiz yopish, PLANNED reysda qabul, qoldirilgan bekatni tortish, olingan buyurtmani bekor qilish", async () => {
    const r1 = await newRequest(w, 0);
    const r2 = await newRequest(w, 1);
    const tripId = await newTrip(w, [r1, r2]);
    expectError(await accept(w, tripId, "100"), "INVALID_TRANSITION");
    expectError(await closeTrip(w.operator, { tripId }), "INVALID_TRANSITION");

    const [s1, s2] = await stopsOf(tripId);
    okData(await skipStop(w.collector, { stopId: s1!.id, reason: "Karton tayyor emas" }));
    expectError(await recordWeighing(w.collector, { stopId: s1!.id, clientKey: key(), grossKg: "10", tareKg: "0" }), "INVALID_TRANSITION");
    okData(await recordWeighing(w.collector, { stopId: s2!.id, clientKey: key(), grossKg: "100", tareKg: "0" }));
    expectError(await cancelPickupRequest(w.shops[1]!.actor, { requestId: r2 }), "INVALID_TRANSITION");
    expectError(await cancelTrip(w.operator, { tripId, reason: "Bekor qilish testi" }), "INVALID_TRANSITION");

    // qabulsiz yopish (reys COLLECTED)
    const close = await closeTrip(w.operator, { tripId });
    expectError(close, "INVALID_TRANSITION");
    if (!close.ok) expect(close.error).toMatch(/xaridor qabuli/i);
  });

  it("reys tahriri: olib tashlangan buyurtma navbatga qaytadi; bekor qilingan reys buyurtmalari NEW", async () => {
    const r1 = await newRequest(w, 0);
    const r2 = await newRequest(w, 1);
    const tripId = await newTrip(w, [r1, r2]);
    okData(await reorderTripStops(w.operator, { tripId, requestIds: [r2] }));
    expect((await prisma.pickupRequest.findUniqueOrThrow({ where: { id: r1 } })).status).toBe("NEW");
    expect((await stopsOf(tripId)).map((s) => [s.requestId, s.sequence])).toEqual([[r2, 1]]);
    okData(await cancelTrip(w.operator, { tripId, reason: "Mashina buzildi" }));
    expect((await prisma.pickupRequest.findUniqueOrThrow({ where: { id: r2 } })).status).toBe("NEW");
    // endi boshqa reysga qo'shish mumkin
    await newTrip(w, [r1, r2]);
  });
});

describe("qoldirish va qayta rejalash", () => {
  it("skip → SKIPPED (navbatda sabab bilan) → yangi reys → PLANNED; hammasi qoldirilsa reys CANCELLED", async () => {
    const req = await newRequest(w, 2);
    const tripId = await newTrip(w, [req]);
    const [stop] = await stopsOf(tripId);
    expectError(await skipStop(w.collector, { stopId: stop!.id, reason: "" }), "VALIDATION");
    okData(await skipStop(w.collector, { stopId: stop!.id, reason: "Karton tayyor emas" }));
    expect((await prisma.pickupRequest.findUniqueOrThrow({ where: { id: req } })).status).toBe("SKIPPED");
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: tripId } })).status).toBe("CANCELLED");

    const queue = await loadQueue(w.operator, {});
    const item = queue?.items.find((i) => i.id === req);
    expect(item?.status).toBe("SKIPPED");
    expect(item?.lastSkipReason).toBe("Karton tayyor emas");

    const trip2 = await newTrip(w, [req]);
    expect((await prisma.pickupRequest.findUniqueOrThrow({ where: { id: req } })).status).toBe("PLANNED");
    const [stop2] = await stopsOf(trip2);
    okData(await recordWeighing(w.collector, { stopId: stop2!.id, clientKey: key(), grossKg: "30", tareKg: "0" }));
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: trip2 } })).status).toBe("COLLECTED");
  });
});

describe("vazn bahsi", () => {
  it("ochiq bahs bilan yopish rad; qaror → ikki tomon rozi → RESOLVED → majburiyat qayta hisoblanadi → yopish", async () => {
    const { tripId, stops } = await collectedTrip(w, [["185", "5"], ["162,5", "2,5"], ["161", "1"]], { confirm: false });
    const shopA = w.shops[0]!.actor;
    // ikkita bekat tasdiqlanadi, birinchisi bahsli
    okData(await confirmStopWeight(w.shops[1]!.actor, { stopId: stops[1]!.id }));
    okData(await confirmStopWeight(w.shops[2]!.actor, { stopId: stops[2]!.id }));
    expectError(await disputeStopWeight(shopA, { stopId: stops[0]!.id, reason: "ha" }), "VALIDATION");
    const { disputeId } = okData(await disputeStopWeight(shopA, { stopId: stops[0]!.id, reason: "Bizning tarozida 190 kg chiqdi", claimedKg: "190" }));
    // takror yuborish — o'sha bahs
    const again = await disputeStopWeight(shopA, { stopId: stops[0]!.id, reason: "Bizning tarozida 190 kg chiqdi", claimedKg: "190" });
    expect(again.ok && again.replayed && again.data.disputeId).toBe(disputeId);
    expectError(await confirmStopWeight(shopA, { stopId: stops[0]!.id }), "INVALID_TRANSITION");

    okData(await accept(w, tripId, "470"));
    const ob = await obligationsOf(tripId);
    for (const o of Object.values(ob)) okData(await recordPayment(w.operator, { obligationId: o.id, clientKey: key(), amount: o.amount, paidDate: today() }));

    // ochiq bahs bilan yopish rad
    const c1 = await closeTrip(w.operator, { tripId });
    expectError(c1, "INVALID_TRANSITION");
    if (!c1.ok) expect(c1.error).toMatch(/bahs/i);

    // rozilik qarordan oldin — rad
    expectError(await acknowledgeDispute(shopA, { disputeId, agree: true }), "INVALID_TRANSITION");
    okData(await decideDispute(w.operator, { disputeId, decisionText: "Qayta tortish natijasi bo‘yicha 185 kg", decidedKg: "185" }));
    // yig'uvchi rozi emas → OPEN
    expect(okData(await acknowledgeDispute(w.collector, { disputeId, agree: false, comment: "Tarozi to‘g‘ri edi" })).status).toBe("OPEN");
    okData(await decideDispute(w.operator, { disputeId, decisionText: "Video ko‘rildi, 185 kg qabul qilinadi", decidedKg: "185" }));
    expect(okData(await acknowledgeDispute(shopA, { disputeId, agree: true })).status).toBe("DECIDED");
    // begona yig'uvchi — NOT_FOUND
    expectError(await acknowledgeDispute(w.collector2, { disputeId, agree: true }), "NOT_FOUND");
    expect(okData(await acknowledgeDispute(w.collector, { disputeId, agree: true })).status).toBe("RESOLVED");

    const d = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    expect(d.status).toBe("RESOLVED");
    expect(d.openKey).toBeNull();
    expect((await prisma.pickupRequest.findFirstOrThrow({ where: { stops: { some: { id: stops[0]!.id } } } })).status).toBe("CONFIRMED");

    // 185 kg × 800 = 148 000 (avval 144 000) — to'lanmagan qoldiq 4 000
    const after = await obligationsOf(tripId);
    expect(after[`SHOP_PAYOUT:${stops[0]!.id}`]?.amount).toBe(148_000);
    const s = await loadSettlement(prisma, tripId);
    expect(s?.deliveredGrams).toBe(505_000);

    const c2 = okData(await closeTrip(w.operator, { tripId }));
    expect(c2.status).toBe("AWAITING_PAYMENT");
    okData(await recordPayment(w.operator, { obligationId: after[`SHOP_PAYOUT:${stops[0]!.id}`]!.id, clientKey: key(), amount: 4_000, paidDate: today() }));
    expect(okData(await closeTrip(w.operator, { tripId })).status).toBe("CLOSED");
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadSettlement } from "@/server/services/obligations";
import { closeTrip, correctRecord, recordPayment } from "@/server/services/trips";
import { createTariff } from "@/server/services/catalog";
import { loadTripDetail } from "@/server/loaders/operator";
import { loadShopHome } from "@/server/loaders/shop";
import { accept, collectedTrip, expectError, key, makeWorld, newRequest, newTrip, obligationsOf, okData, today, transport, type World } from "./helpers";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});

describe("majburiy misol DB orqali: 180 + 160 + 160 kg", () => {
  it("470 kg qabul → tushum 705 000, do‘konlar 400 000, hissa 5 000; xizmat haqi 3 000 → 2 000", async () => {
    const { tripId, stops } = await collectedTrip(w);
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.status).toBe("COLLECTED");
    expect(trip.tariffId).toBe(w.tariffId);

    // Tafovut bor — izoh va qarorsiz rad
    const noReason = await accept(w, tripId, "470", false);
    expectError(noReason, "VALIDATION");
    if (!noReason.ok) expect(noReason.fieldErrors).toHaveProperty("discrepancyReason");

    const acc = okData(await accept(w, tripId, "470"));
    expect(acc.discrepancyGrams).toBe(-30_000);
    await transport(w, tripId);

    const ob = await obligationsOf(tripId);
    expect(ob.BUYER_MATERIAL?.amount).toBe(705_000);
    expect(ob.SERVICE_FEE?.amount).toBe(3_000);
    const shopTotal = stops.reduce((s, st) => s + (ob[`SHOP_PAYOUT:${st.id}`]?.amount ?? 0), 0);
    expect(shopTotal).toBe(400_000);
    expect(stops.map((st) => ob[`SHOP_PAYOUT:${st.id}`]?.amount)).toEqual([144_000, 128_000, 128_000]);

    const s = await loadSettlement(prisma, tripId);
    expect(s).toMatchObject({ deliveredGrams: 500_000, acceptedGrams: 470_000, buyerRevenue: 705_000, shopPayoutTotal: 400_000, expensesTotal: 300_000, tripContribution: 5_000, partnerShareAfterFee: 2_000, ecoPointServiceIncome: 3_000 });

    // Xizmat haqi: 1 000 to'langanda qoldiq 2 000
    const fee = okData(await recordPayment(w.operator, { obligationId: ob.SERVICE_FEE!.id, clientKey: key(), amount: 1_000, paidDate: today() }));
    expect(fee.remaining).toBe(2_000);

    const detail = await loadTripDetail(w.operator, tripId);
    expect(detail?.settlement?.tripContribution).toBe(5_000);
    expect(detail?.acceptance?.discrepancyGrams).toBe(-30_000);
    expect(detail?.obligations.find((o) => o.type === "SERVICE_FEE")).toMatchObject({ paid: 1_000, remaining: 2_000, state: "PARTIAL" });
  });

  it("500 kg qabul → hissa 50 000 (tafovutsiz, izoh talab qilinmaydi)", async () => {
    const { tripId } = await collectedTrip(w);
    okData(await accept(w, tripId, "500", false));
    await transport(w, tripId);
    const s = await loadSettlement(prisma, tripId);
    expect(s?.buyerRevenue).toBe(750_000);
    expect(s?.tripContribution).toBe(50_000);
    expect(s?.discrepancyGrams).toBe(0);
  });
});

describe("to‘lov va yopish", () => {
  it("qisman to‘lov → AWAITING_PAYMENT → to‘liq → CLOSED, buyurtmalar SETTLED", async () => {
    const { tripId, requestIds } = await collectedTrip(w);
    okData(await accept(w, tripId, "470"));
    await transport(w, tripId);
    const ob = await obligationsOf(tripId);
    const list = Object.values(ob);

    // qisman
    okData(await recordPayment(w.operator, { obligationId: ob.BUYER_MATERIAL!.id, clientKey: key(), amount: 500_000, paidDate: today() }));
    const r1 = okData(await closeTrip(w.operator, { tripId }));
    expect(r1.status).toBe("AWAITING_PAYMENT");
    expect(r1.failed.map((c) => c.key)).toEqual(["PAID"]);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: tripId } })).status).toBe("AWAITING_PAYMENT");

    // to'liq
    for (const o of list) {
      const paid = o.key === "BUYER_MATERIAL" ? 500_000 : 0;
      const rest = o.amount - paid;
      if (rest > 0) okData(await recordPayment(w.operator, { obligationId: o.id, clientKey: key(), amount: rest, paidDate: today(), method: "Naqd" }));
    }
    const r2 = okData(await closeTrip(w.operator, { tripId }));
    expect(r2.status).toBe("CLOSED");
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.status).toBe("CLOSED");
    expect(trip.closedAt).not.toBeNull();
    const reqs = await prisma.pickupRequest.findMany({ where: { id: { in: requestIds } } });
    expect(reqs.every((r) => r.status === "SETTLED")).toBe(true);

    // Yopilgandan keyin takroriy to'lov rad etiladi
    const again = await recordPayment(w.operator, { obligationId: ob.BUYER_MATERIAL!.id, clientKey: key(), amount: 1, paidDate: today() });
    expectError(again, "OVERPAYMENT");

    // Do'kon o'z to'lovini ko'radi
    const home = await loadShopHome(w.shops[0]!.actor);
    expect(home?.lastReceipt?.payState).toBe("PAID");
  });

  it("yopilgandan keyin tuzatish: audit before/after/reason, balans qayta hisoblanadi, AWAITING_PAYMENT", async () => {
    const { tripId, stops } = await collectedTrip(w);
    okData(await accept(w, tripId, "470"));
    const ob = await obligationsOf(tripId);
    for (const o of Object.values(ob)) okData(await recordPayment(w.operator, { obligationId: o.id, clientKey: key(), amount: o.amount, paidDate: today() }));
    expect(okData(await closeTrip(w.operator, { tripId })).status).toBe("CLOSED");

    const weighing = await prisma.weighing.findUniqueOrThrow({ where: { stopId: stops[0]!.id } });
    expectError(await correctRecord(w.operator, { tripId, target: "WEIGHING", weighingId: weighing.id, grossKg: "195", tareKg: "5", reason: "" }), "VALIDATION");
    okData(await correctRecord(w.operator, { tripId, target: "WEIGHING", weighingId: weighing.id, grossKg: "195", tareKg: "5", reason: "Tarozi qaydi qayta tekshirildi" }));

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { tripId, action: "CORRECTION", entityId: weighing.id } });
    expect(audit.reason).toBe("Tarozi qaydi qayta tekshirildi");
    expect(audit.actorId).toBe(w.operator.id);
    expect(audit.before).toMatchObject({ grossGrams: 185_000, tareGrams: 5_000, netGrams: 180_000 });
    expect(audit.after).toMatchObject({ grossGrams: 195_000, tareGrams: 5_000, netGrams: 190_000 });
    expect(audit.at).toBeInstanceOf(Date);

    const after = await obligationsOf(tripId);
    expect(after[`SHOP_PAYOUT:${stops[0]!.id}`]?.amount).toBe(152_000); // 190 kg × 800
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.status).toBe("AWAITING_PAYMENT");
    const acc = await prisma.buyerAcceptance.findUniqueOrThrow({ where: { tripId } });
    expect(acc.deliveredGrams).toBe(510_000);
    expect(acc.discrepancyGrams).toBe(-40_000);
    expect(await prisma.auditEvent.count({ where: { tripId, action: "OBLIGATIONS_RECOMPUTED" } })).toBeGreaterThan(0);

    // qoldiqni to'lab yana yopish mumkin
    okData(await recordPayment(w.operator, { obligationId: after[`SHOP_PAYOUT:${stops[0]!.id}`]!.id, clientKey: key(), amount: 8_000, paidDate: today() }));
    expect(okData(await closeTrip(w.operator, { tripId })).status).toBe("CLOSED");
  });

  it("yangi tarif eski reys narx nusxasini o‘zgartirmaydi", async () => {
    const r1 = await newRequest(w, 0);
    const oldTrip = await newTrip(w, [r1]);
    const newTariff = okData(await createTariff(w.operator, { shopPricePerKg: 900, buyerPricePerKg: 1700, serviceFee: 4000, note: "test" }));
    const old = await prisma.trip.findUniqueOrThrow({ where: { id: oldTrip } });
    expect(old).toMatchObject({ shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000, tariffId: w.tariffId });

    const r2 = await newRequest(w, 1);
    const fresh = await newTrip(w, [r2], { shopPricePerKg: 900, buyerPricePerKg: 1700, serviceFee: 4000 });
    const t2 = await prisma.trip.findUniqueOrThrow({ where: { id: fresh } });
    expect(t2.tariffId).toBe(newTariff.tariffId);
    expect(t2.shopPricePerKg).toBe(900);
    // eski reys hali ham eski narxda
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: oldTrip } })).shopPricePerKg).toBe(800);
  });
});

// Seed qayta ishlaydi: ikki marta → sonlar bir xil; namunaviy reys izchil.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runSeed } from "../../prisma/seed";
import { loadSettlement } from "@/server/services/obligations";
import { tashkentToday } from "@/domain/time";

async function counts() {
  const [users, shops, points, buyers, tariffs, requests, trips, payments, obligations, weighings] = await Promise.all([
    prisma.user.count(),
    prisma.shop.count(),
    prisma.point.count(),
    prisma.buyer.count(),
    prisma.tariff.count(),
    prisma.pickupRequest.count(),
    prisma.trip.count(),
    prisma.payment.count(),
    prisma.obligation.count(),
    prisma.weighing.count(),
  ]);
  return { users, shops, points, buyers, tariffs, requests, trips, payments, obligations, weighings };
}

describe("seed", () => {
  it("ikki marta ishga tushirish dublikat bermaydi", async () => {
    const first = await runSeed();
    const c1 = await counts();
    const second = await runSeed();
    const c2 = await counts();
    expect(c2).toEqual(c1);
    expect(second.sampleTripId).toBe(first.sampleTripId);
    expect(second.todayRequestIds).toEqual(first.todayRequestIds);

    const demo = await prisma.user.findMany({ where: { isDemo: true }, select: { login: true } });
    expect(demo.map((u) => u.login).sort()).toEqual(["dokon1", "dokon2", "dokon3", "operator", "yiguvchi1", "yiguvchi2"]);
    const nur = await prisma.shop.findFirstOrThrow({ where: { name: "Nur market" }, include: { points: true } });
    expect(nur.points).toHaveLength(2);
  });

  it("namunaviy reys: 470 kg, AWAITING_PAYMENT, majburiyatlar settlement bilan mos", async () => {
    const trip = await prisma.trip.findUniqueOrThrow({ where: { clientKey: "seed-sample-trip" }, include: { obligations: { include: { payments: true } }, stops: { include: { confirmation: true } } } });
    expect(trip.status).toBe("AWAITING_PAYMENT");
    expect(trip.stops.every((s) => s.confirmation?.status === "CONFIRMED")).toBe(true);
    const s = await loadSettlement(prisma, trip.id);
    expect(s).toMatchObject({ deliveredGrams: 500_000, acceptedGrams: 470_000, buyerRevenue: 705_000, shopPayoutTotal: 400_000, expensesTotal: 300_000, tripContribution: 5_000, partnerShareAfterFee: 2_000 });
    const paid = Object.fromEntries(trip.obligations.map((o) => [o.type === "SHOP_PAYOUT" ? `${o.type}:${o.amount}:${o.shopId}` : o.type, o.payments.reduce((a, p) => a + p.amount, 0)]));
    expect(paid.BUYER_MATERIAL).toBe(705_000);
    expect(paid.SERVICE_FEE).toBe(1_000);
    const shopPaid = trip.obligations.filter((o) => o.type === "SHOP_PAYOUT").map((o) => o.payments.reduce((a, p) => a + p.amount, 0)).sort((a, b) => b - a);
    expect(shopPaid).toEqual([144_000, 64_000, 0]);
    expect(await prisma.pickupRequest.count({ where: { clientKey: { startsWith: `seed-today-${tashkentToday()}-` }, status: "NEW" } })).toBe(3);
  });
});

// Reys hisob-kitobi uchun DB'dan ma'lumot yig'ish va majburiyatlarni qayta hisoblash.
import type { SettlementDTO } from "@/server/contract";
import { computeSettlement, effectiveNetGrams, paidAmount, planObligations, type SettlementStop } from "@/domain/settlement";
import { audit, type Tx } from "./core";

/** Reysning amaldagi (olingan) bekatlari va ularning sof vazni. */
export async function loadDeliveredStops(tx: Tx, tripId: string): Promise<SettlementStop[]> {
  const stops = await tx.tripStop.findMany({
    where: { tripId, status: "COLLECTED" },
    orderBy: { sequence: "asc" },
    include: {
      weighing: { select: { netGrams: true } },
      disputes: { select: { status: true, decidedNetGrams: true, resolvedAt: true } },
      request: { select: { shopId: true, shop: { select: { name: true } } } },
    },
  });
  const out: SettlementStop[] = [];
  for (const s of stops) {
    const net = effectiveNetGrams(s.status, s.weighing?.netGrams ?? null, s.disputes);
    if (net === null) continue;
    out.push({ stopId: s.id, shopId: s.request.shopId, shopName: s.request.shop.name, netGrams: net });
  }
  return out;
}

/** Qabul mavjud bo'lsa reys hisob-kitobi, aks holda null. */
export async function loadSettlement(tx: Tx, tripId: string): Promise<SettlementDTO | null> {
  const trip = await tx.trip.findUnique({
    where: { id: tripId },
    select: {
      shopPricePerKg: true,
      serviceFee: true,
      acceptance: { select: { acceptedGrams: true, buyerPricePerKg: true } },
      expenses: { select: { amount: true } },
    },
  });
  if (!trip?.acceptance) return null;
  const stops = await loadDeliveredStops(tx, tripId);
  return computeSettlement({
    stops,
    acceptedGrams: trip.acceptance.acceptedGrams,
    buyerPricePerKg: trip.acceptance.buyerPricePerKg,
    shopPricePerKg: trip.shopPricePerKg,
    expenses: trip.expenses.map((e) => e.amount),
    serviceFee: trip.serviceFee,
  });
}

export interface ObligationBalance {
  id: string;
  key: string;
  amount: number;
  paid: number;
  remaining: number;
}

export async function loadBalances(tx: Tx, tripId: string): Promise<ObligationBalance[]> {
  const rows = await tx.obligation.findMany({
    where: { tripId },
    include: { payments: { select: { kind: true, amount: true } } },
  });
  return rows.map((o) => {
    const paid = paidAmount(o.payments);
    return { id: o.id, key: o.key, amount: o.amount, paid, remaining: o.amount - paid };
  });
}

/**
 * Majburiyatlarni settlement bilan moslaydi (upsert). Endi kerak bo'lmagan va to'lovi
 * yo'q majburiyat o'chiriladi; to'lovi bor bo'lsa summasi 0 ga tushiriladi (ortiqcha to'lov ko'rinadi).
 * Qabul bo'lmasa hech narsa qilmaydi. O'zgarish bo'lsa audit yoziladi.
 */
export async function recomputeObligations(
  tx: Tx,
  tripId: string,
  actorId: string | null,
  reason?: string,
): Promise<{ settlement: SettlementDTO | null; changed: boolean }> {
  const settlement = await loadSettlement(tx, tripId);
  if (!settlement) return { settlement: null, changed: false };
  const plan = planObligations(settlement);
  const existing = await tx.obligation.findMany({
    where: { tripId },
    include: { _count: { select: { payments: true } } },
  });
  const byKey = new Map(existing.map((o) => [o.key, o]));
  const before: Record<string, number> = Object.fromEntries(existing.map((o) => [o.key, o.amount]));
  const after: Record<string, number> = {};
  let changed = false;

  for (const p of plan) {
    after[p.key] = p.amount;
    const cur = byKey.get(p.key);
    if (!cur) {
      await tx.obligation.create({
        data: { tripId, key: p.key, type: p.type, payer: p.payer, payee: p.payee, shopId: p.shopId, stopId: p.stopId, amount: p.amount },
      });
      changed = true;
    } else if (cur.amount !== p.amount) {
      await tx.obligation.update({ where: { id: cur.id }, data: { amount: p.amount } });
      changed = true;
    }
    byKey.delete(p.key);
  }
  for (const stale of byKey.values()) {
    if (stale._count.payments === 0) {
      await tx.obligation.delete({ where: { id: stale.id } });
      changed = true;
    } else {
      after[stale.key] = 0;
      if (stale.amount !== 0) {
        await tx.obligation.update({ where: { id: stale.id }, data: { amount: 0 } });
        changed = true;
      }
    }
  }
  if (changed && existing.length > 0) {
    await audit(tx, {
      actorId,
      action: "OBLIGATIONS_RECOMPUTED",
      entityType: "Trip",
      entityId: tripId,
      tripId,
      reason: reason ?? null,
      before,
      after,
    });
  }
  return { settlement, changed };
}

/** Reys hamma bekati hal bo'lsa holatini yangilaydi: COLLECTED yoki (hammasi qoldirilgan) CANCELLED. */
export async function settleTripProgress(tx: Tx, tripId: string, actorId: string): Promise<"COLLECTED" | "CANCELLED" | null> {
  const stops = await tx.tripStop.findMany({ where: { tripId, status: { not: "REMOVED" } }, select: { status: true } });
  if (stops.length === 0 || stops.some((s) => s.status === "PENDING")) return null;
  const anyCollected = stops.some((s) => s.status === "COLLECTED");
  const to = anyCollected ? "COLLECTED" : "CANCELLED";
  const r = await tx.trip.updateMany({
    where: { id: tripId, status: "IN_PROGRESS" },
    data: anyCollected
      ? { status: "COLLECTED", version: { increment: 1 } }
      : { status: "CANCELLED", cancelReason: "Barcha bekatlar qoldirildi", version: { increment: 1 } },
  });
  if (r.count === 1) {
    await audit(tx, { actorId, action: "TRIP_STATUS", entityType: "Trip", entityId: tripId, tripId, before: { status: "IN_PROGRESS" }, after: { status: to } });
    return to;
  }
  return null;
}

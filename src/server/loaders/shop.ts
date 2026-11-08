// Do'kon ko'rinishlari (actor bo'yicha; begona obyekt → null).
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ShopHistory, ShopHome, ShopReceipt, ShopRequestDetail, ShopRequestSummary } from "@/server/contract";
import { amountForWeight } from "@/domain/money";
import { effectiveNetGrams, paidAmount, payState } from "@/domain/settlement";
import type { Actor } from "@/server/services/core";
import { attachmentSelect, disputeInclude, pointInclude, stopInclude, toAttachment, toDispute, toPoint, toStop } from "./dto";

const requestInclude = {
  point: { include: pointInclude },
  stops: {
    orderBy: { createdAt: "asc" },
    include: {
      trip: { include: { collector: { select: { name: true, phone: true } } } },
      weighing: { select: { netGrams: true } },
      disputes: { select: { status: true, decidedNetGrams: true, resolvedAt: true } },
      confirmation: { select: { status: true } },
    },
  },
} satisfies Prisma.PickupRequestInclude;
type RequestRow = Prisma.PickupRequestGetPayload<{ include: typeof requestInclude }>;

const receiptInclude = {
  trip: { select: { number: true, shopPricePerKg: true } },
  request: { select: { id: true, number: true, point: { select: { name: true } } } },
  weighing: { select: { netGrams: true } },
  disputes: { select: { status: true, decidedNetGrams: true, resolvedAt: true } },
  confirmation: { select: { status: true } },
  obligations: { where: { type: "SHOP_PAYOUT" }, include: { payments: { select: { kind: true, amount: true } } } },
} satisfies Prisma.TripStopInclude;
type ReceiptRow = Prisma.TripStopGetPayload<{ include: typeof receiptInclude }>;

function pickStop(r: RequestRow) {
  const active = r.stops.find((s) => s.activeRequestKey !== null);
  if (active) return active;
  const visible = r.stops.filter((s) => s.status !== "REMOVED");
  return visible[visible.length - 1] ?? null;
}

export function toRequestSummary(r: RequestRow): ShopRequestSummary {
  const s = pickStop(r);
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    point: toPoint(r.point),
    readyFrom: r.readyFrom,
    readyTo: r.readyTo,
    estimatedGrams: r.estimatedGrams,
    volume: r.volume,
    note: r.note,
    createdAt: r.createdAt,
    trip: s
      ? {
          id: s.trip.id,
          number: s.trip.number,
          status: s.trip.status,
          windowStart: s.trip.windowStart,
          windowEnd: s.trip.windowEnd,
          collectorName: s.trip.collector.name,
          collectorPhone: s.trip.collector.phone,
        }
      : null,
    stop: s ? { id: s.id, status: s.status, skipReason: s.skipReason } : null,
    netGrams: s ? effectiveNetGrams(s.status, s.weighing?.netGrams ?? null, s.disputes) : null,
    needsConfirmation: r.status === "COLLECTED" && !!s && s.status === "COLLECTED" && !s.confirmation,
  };
}

function toReceipt(s: ReceiptRow): ShopReceipt | null {
  const net = effectiveNetGrams(s.status, s.weighing?.netGrams ?? null, s.disputes);
  if (net === null) return null;
  const ob = s.obligations[0];
  const amount = ob ? ob.amount : amountForWeight(net, s.trip.shopPricePerKg);
  const paid = ob ? paidAmount(ob.payments) : 0;
  const openDispute = s.disputes.find((d) => d.status !== "RESOLVED");
  const lastDispute = s.disputes[s.disputes.length - 1];
  return {
    requestId: s.request.id,
    requestNumber: s.request.number,
    stopId: s.id,
    tripNumber: s.trip.number,
    pointName: s.request.point.name,
    collectedAt: s.collectedAt,
    netGrams: net,
    pricePerKg: s.trip.shopPricePerKg,
    amount,
    // Xaridor qabulidan keyin majburiyat yaratiladi; summa 0 bo'lsa majburiyat bo'lmasligi mumkin.
    amountIsFinal: !!ob,
    paid,
    remaining: amount - paid,
    payState: payState(amount, paid),
    confirmation: s.confirmation?.status ?? null,
    disputeStatus: (openDispute ?? lastDispute)?.status ?? null,
  };
}

async function receiptsFor(shopId: string, take?: number): Promise<ShopReceipt[]> {
  const rows = await prisma.tripStop.findMany({
    where: { status: "COLLECTED", request: { shopId } },
    orderBy: [{ collectedAt: "desc" }, { createdAt: "desc" }],
    take,
    include: receiptInclude,
  });
  return rows.map(toReceipt).filter((r): r is ShopReceipt => r !== null);
}

const ACTIVE_STATUSES = ["NEW", "PLANNED", "SKIPPED", "COLLECTED", "DISPUTED", "CONFIRMED"] as const;

export async function loadShopHome(actor: Actor): Promise<ShopHome | null> {
  if (actor.role !== "SHOP" || !actor.shopId) return null;
  const shop = await prisma.shop.findUnique({ where: { id: actor.shopId }, include: { points: { where: { isActive: true }, include: pointInclude, orderBy: { createdAt: "asc" } } } });
  if (!shop) return null;

  const active = await prisma.pickupRequest.findMany({
    where: { shopId: shop.id, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { readyFrom: "asc" },
    include: requestInclude,
  });
  const summaries = active.map(toRequestSummary);

  const planned = summaries
    .filter((r) => r.status === "PLANNED" && r.trip && r.stop?.status === "PENDING")
    .sort((a, b) => a.trip!.windowStart.getTime() - b.trip!.windowStart.getTime());
  const fresh = summaries.filter((r) => r.status === "NEW" || r.status === "SKIPPED").sort((a, b) => a.readyFrom.getTime() - b.readyFrom.getTime());
  const nextPickup = planned[0] ?? fresh[0] ?? null;

  const disputes = await prisma.dispute.findMany({
    where: { status: "DECIDED", shopAckAt: null, stop: { request: { shopId: shop.id } } },
    include: { ...disputeInclude, stop: { select: { request: { select: { number: true, point: { select: { name: true } } } } } } },
    orderBy: { decidedAt: "asc" },
  });

  const obligations = await prisma.obligation.findMany({
    where: { shopId: shop.id, type: "SHOP_PAYOUT" },
    include: { payments: { select: { kind: true, amount: true } } },
  });
  let accrued = 0;
  let paid = 0;
  for (const o of obligations) {
    accrued += o.amount;
    paid += paidAmount(o.payments);
  }

  const [lastReceipt] = await receiptsFor(shop.id, 1);
  return {
    shop: { id: shop.id, name: shop.name },
    points: shop.points.map(toPoint),
    nextPickup,
    pendingConfirmations: summaries.filter((r) => r.needsConfirmation),
    disputesAwaitingAck: disputes.map((d) => ({ ...toDispute(d), requestNumber: d.stop.request.number, pointName: d.stop.request.point.name })),
    activeRequests: summaries,
    lastReceipt: lastReceipt ?? null,
    totals: { accrued, paid, remaining: accrued - paid },
  };
}

export async function loadShopRequest(actor: Actor, id: string): Promise<ShopRequestDetail | null> {
  if (!actor.shopId && actor.role === "SHOP") return null;
  const r = await prisma.pickupRequest.findUnique({
    where: { id },
    include: { ...requestInclude, attachments: { select: attachmentSelect, orderBy: { createdAt: "asc" } } },
  });
  if (!r) return null;
  if (actor.role === "SHOP" && r.shopId !== actor.shopId) return null;
  if (actor.role === "COLLECTOR" && !r.stops.some((s) => s.trip.collectorId === actor.id && s.status !== "REMOVED")) return null;

  const summary = toRequestSummary(r);
  const stops = await prisma.tripStop.findMany({
    where: { requestId: r.id, status: { not: "REMOVED" }, ...(actor.role === "COLLECTOR" ? { trip: { collectorId: actor.id } } : {}) },
    orderBy: { createdAt: "asc" },
    include: stopInclude,
  });
  const collected = await prisma.tripStop.findFirst({ where: { requestId: r.id, status: "COLLECTED" }, include: receiptInclude });
  const receipt = collected ? toReceipt(collected) : null;
  const current = pickStop(r);
  return {
    ...summary,
    photos: r.attachments.map(toAttachment),
    stops: stops.map(toStop),
    receipt,
    canCancel: actor.role !== "COLLECTOR" && (r.status === "NEW" || r.status === "SKIPPED"),
    canConfirm: actor.role === "SHOP" && r.status === "COLLECTED" && !!current && current.status === "COLLECTED" && !current.confirmation,
  };
}

export async function loadShopHistory(actor: Actor): Promise<ShopHistory | null> {
  if (actor.role !== "SHOP" || !actor.shopId) return null;
  const receipts = await receiptsFor(actor.shopId, 200);
  const requests = await prisma.pickupRequest.findMany({
    where: { shopId: actor.shopId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: requestInclude,
  });
  return { receipts, requests: requests.map(toRequestSummary) };
}

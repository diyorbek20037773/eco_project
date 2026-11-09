// Operator ko'rinishlari: navbat, reyslar, reys tafsiloti, katalog, audit.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  AcceptanceDTO,
  AuditDTO,
  ExpenseDTO,
  OperatorDashboardCounts,
  OperatorDirectory,
  OperatorQueue,
  QueueFilters,
  QueueItem,
  TripBuilderOptions,
  TripDetail,
  TripListItem,
  TripStatus,
} from "@/server/contract";
import { computeSettlement, evaluateCloseChecks, paidAmount } from "@/domain/settlement";
import { tashkentDayRange } from "@/domain/time";
import type { Actor } from "@/server/services/core";
import { currentTariff } from "@/server/services/trips";
import {
  attachmentSelect,
  obligationInclude,
  pointInclude,
  sortObligations,
  stopEffectiveNet,
  stopInclude,
  toAttachment,
  toBuyer,
  toObligation,
  toPoint,
  toStop,
  toTariff,
} from "./dto";

function isOperator(actor: Actor): boolean {
  return actor.role === "OPERATOR";
}

const OPEN_DISPUTE = ["OPEN", "DECIDED"] as const;
const ACTIVE_TRIP: TripStatus[] = ["PLANNED", "IN_PROGRESS", "COLLECTED", "ACCEPTED", "AWAITING_PAYMENT"];

export async function loadOperatorCounts(actor: Actor): Promise<OperatorDashboardCounts | null> {
  if (!isOperator(actor)) return null;
  const [queue, activeTrips, awaitingAcceptance, awaitingPayment, openDisputes] = await Promise.all([
    prisma.pickupRequest.count({ where: { status: { in: ["NEW", "SKIPPED"] } } }),
    prisma.trip.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
    prisma.trip.count({ where: { status: "COLLECTED" } }),
    prisma.trip.count({ where: { status: "AWAITING_PAYMENT" } }),
    prisma.dispute.count({ where: { status: { in: [...OPEN_DISPUTE] } } }),
  ]);
  return { queue, activeTrips, awaitingAcceptance, awaitingPayment, openDisputes };
}

// ---------------------------------------------------------------------------
// Navbat
// ---------------------------------------------------------------------------
const queueInclude = {
  point: { include: pointInclude },
  attachments: { select: { id: true }, take: 1 },
  stops: { where: { status: "SKIPPED" }, orderBy: { skippedAt: "desc" }, take: 1, select: { skipReason: true } },
} satisfies Prisma.PickupRequestInclude;
type QueueRow = Prisma.PickupRequestGetPayload<{ include: typeof queueInclude }>;

function toQueueItem(r: QueueRow, now: Date): QueueItem {
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
    hasPhoto: r.attachments.length > 0,
    createdAt: r.createdAt,
    lastSkipReason: r.status === "SKIPPED" ? (r.stops[0]?.skipReason ?? null) : null,
    isLate: r.readyTo.getTime() < now.getTime(),
  };
}

async function districts(): Promise<string[]> {
  const rows = await prisma.point.findMany({ where: { isActive: true }, distinct: ["district"], select: { district: true }, orderBy: { district: "asc" } });
  return rows.map((r) => r.district);
}

export async function loadQueue(actor: Actor, filters: QueueFilters, now: Date = new Date()): Promise<OperatorQueue | null> {
  if (!isOperator(actor)) return null;
  const where: Prisma.PickupRequestWhereInput = { status: { in: ["NEW", "SKIPPED"] } };
  const clean: QueueFilters = {};
  if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    const { start, end } = tashkentDayRange(filters.date);
    where.readyFrom = { gte: start, lt: end };
    clean.date = filters.date;
  }
  if (filters.district && filters.district.length <= 80) {
    where.point = { district: filters.district };
    clean.district = filters.district;
  }
  const rows = await prisma.pickupRequest.findMany({ where, orderBy: [{ readyFrom: "asc" }, { number: "asc" }], include: queueInclude, take: 500 });
  return { filters: clean, districts: await districts(), items: rows.map((r) => toQueueItem(r, now)) };
}

export async function loadTripBuilderOptions(actor: Actor, requestIds: string[]): Promise<TripBuilderOptions | null> {
  if (!isOperator(actor)) return null;
  const ids = [...new Set(requestIds.filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)))].slice(0, 30);
  const [collectors, buyers, tariff, rows] = await Promise.all([
    prisma.user.findMany({ where: { role: "COLLECTOR", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    prisma.buyer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    currentTariff(prisma),
    ids.length ? prisma.pickupRequest.findMany({ where: { id: { in: ids }, status: { in: ["NEW", "SKIPPED"] } }, include: queueInclude }) : Promise.resolve([]),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  return {
    collectors,
    buyers: buyers.map(toBuyer),
    currentTariff: tariff ? toTariff(tariff) : null,
    selected: ids.map((id) => byId.get(id)).filter((r): r is QueueRow => !!r).map((r) => toQueueItem(r, now)),
  };
}

// ---------------------------------------------------------------------------
// Reyslar ro'yxati
// ---------------------------------------------------------------------------
export async function loadTrips(actor: Actor, filter: { status?: TripStatus | "ACTIVE" | "ALL" }): Promise<TripListItem[] | null> {
  if (!isOperator(actor)) return null;
  const where: Prisma.TripWhereInput =
    !filter.status || filter.status === "ALL" ? {} : filter.status === "ACTIVE" ? { status: { in: ACTIVE_TRIP } } : { status: filter.status };
  const trips = await prisma.trip.findMany({
    where,
    orderBy: [{ windowStart: "desc" }, { number: "desc" }],
    take: 300,
    include: {
      collector: { select: { name: true } },
      buyer: { select: { name: true } },
      acceptance: { select: { acceptedGrams: true } },
      stops: { where: { status: { not: "REMOVED" } }, include: { weighing: { select: { netGrams: true } }, disputes: { select: { status: true, decidedNetGrams: true, resolvedAt: true } } } },
      obligations: { include: { payments: { select: { kind: true, amount: true } } } },
    },
  });
  return trips.map((t) => {
    const delivered = t.stops.reduce((s, x) => s + (stopEffectiveNet(x) ?? 0), 0);
    const remaining = t.obligations.reduce((s, o) => s + Math.max(0, o.amount - paidAmount(o.payments)), 0);
    return {
      id: t.id,
      number: t.number,
      status: t.status,
      windowStart: t.windowStart,
      windowEnd: t.windowEnd,
      collectorName: t.collector.name,
      buyerName: t.buyer.name,
      stopCount: t.stops.length,
      doneCount: t.stops.filter((s) => s.status === "COLLECTED" || s.status === "SKIPPED").length,
      deliveredGrams: delivered,
      acceptedGrams: t.acceptance?.acceptedGrams ?? null,
      openDisputes: t.stops.reduce((s, x) => s + x.disputes.filter((d) => d.status !== "RESOLVED").length, 0),
      remainingToPay: remaining,
    };
  });
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
const auditInclude = { actor: { select: { name: true } }, trip: { select: { number: true } } } satisfies Prisma.AuditEventInclude;
type AuditRow = Prisma.AuditEventGetPayload<{ include: typeof auditInclude }>;

function toAudit(a: AuditRow): AuditDTO {
  return {
    id: a.id,
    at: a.at,
    actorName: a.actor?.name ?? null,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    tripNumber: a.trip?.number ?? null,
    reason: a.reason,
    before: a.before,
    after: a.after,
  };
}

export async function loadAudit(actor: Actor, filter: { tripId?: string; limit?: number }): Promise<AuditDTO[] | null> {
  if (!isOperator(actor)) return null;
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  const rows = await prisma.auditEvent.findMany({
    where: filter.tripId ? { tripId: filter.tripId } : {},
    orderBy: { at: "desc" },
    take: limit,
    include: auditInclude,
  });
  return rows.map(toAudit);
}

// ---------------------------------------------------------------------------
// Reys tafsiloti
// ---------------------------------------------------------------------------
export async function loadTripDetail(actor: Actor, id: string): Promise<TripDetail | null> {
  if (!isOperator(actor)) return null;
  const t = await prisma.trip.findUnique({
    where: { id },
    include: {
      collector: { select: { id: true, name: true, phone: true } },
      buyer: true,
      // REMOVED bekatlar ham yuklanadi — sahifa ularni «Reysdan olib tashlangan» deb ko‘rsatadi; hisobda faqat faollar.
      stops: { orderBy: { sequence: "asc" }, include: stopInclude },
      acceptance: {
        include: {
          recordedBy: { select: { name: true } },
          documents: { select: attachmentSelect, orderBy: { createdAt: "asc" } },
        },
      },
      expenses: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      obligations: { include: obligationInclude },
    },
  });
  if (!t) return null;

  const stops = t.stops.map(toStop);
  const activeStops = t.stops.filter((s) => s.status !== "REMOVED");
  const deliveredStops = activeStops
    .map((s) => ({ s, net: stopEffectiveNet(s) }))
    .filter((x): x is { s: (typeof activeStops)[number]; net: number } => x.net !== null)
    .map(({ s, net }) => ({ stopId: s.id, shopId: s.request.shopId, shopName: s.request.point.shop.name, netGrams: net }));
  const deliveredGrams = deliveredStops.reduce((sum, s) => sum + s.netGrams, 0);

  const settlement = t.acceptance
    ? computeSettlement({
        stops: deliveredStops,
        acceptedGrams: t.acceptance.acceptedGrams,
        buyerPricePerKg: t.acceptance.buyerPricePerKg,
        shopPricePerKg: t.shopPricePerKg,
        expenses: t.expenses.map((e) => e.amount),
        serviceFee: t.serviceFee,
      })
    : null;

  const obligations = sortObligations(t.obligations.map(toObligation));
  const closeChecks = evaluateCloseChecks({
    stops: activeStops.map((s) => ({ status: s.status, confirmation: s.confirmation?.status ?? null, disputes: s.disputes })),
    hasAcceptance: !!t.acceptance,
    obligations: obligations.map((o) => ({ amount: o.amount, paid: o.paid })),
  });

  const acceptance: AcceptanceDTO | null = t.acceptance
    ? {
        id: t.acceptance.id,
        acceptedGrams: t.acceptance.acceptedGrams,
        deliveredGrams: t.acceptance.deliveredGrams,
        discrepancyGrams: t.acceptance.discrepancyGrams,
        quality: t.acceptance.quality,
        qualityNote: t.acceptance.qualityNote,
        discrepancyReason: t.acceptance.discrepancyReason,
        decision: t.acceptance.decision,
        decisionNote: t.acceptance.decisionNote,
        buyerPricePerKg: t.acceptance.buyerPricePerKg,
        buyerReference: t.acceptance.buyerReference,
        acceptedAt: t.acceptance.acceptedAt,
        recordedByName: t.acceptance.recordedBy.name,
        documents: t.acceptance.documents.map(toAttachment),
      }
    : null;

  const expenses: ExpenseDTO[] = t.expenses.map((e) => ({
    id: e.id,
    type: e.type,
    amount: e.amount,
    payer: e.payer,
    recipient: e.recipient,
    note: e.note,
    createdAt: e.createdAt,
    createdByName: e.createdBy.name,
  }));

  const audit = (await loadAudit(actor, { tripId: t.id, limit: 200 })) ?? [];
  const hasOverpaid = obligations.some((o) => o.remaining < 0);
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  return {
    id: t.id,
    number: t.number,
    status: t.status,
    windowStart: t.windowStart,
    windowEnd: t.windowEnd,
    collector: t.collector,
    buyer: toBuyer(t.buyer),
    prices: { shopPricePerKg: t.shopPricePerKg, buyerPricePerKg: t.buyerPricePerKg, serviceFee: t.serviceFee, tariffId: t.tariffId },
    responsibleParty: t.responsibleParty,
    vehicle: t.vehicle,
    note: t.note,
    cancelReason: t.cancelReason,
    closedAt: t.closedAt,
    stops,
    acceptance,
    expenses,
    obligations,
    settlement,
    deliveredGrams,
    closeChecks,
    audit,
    allowed: {
      reorder: t.status === "PLANNED",
      cancel: t.status === "PLANNED",
      recordAcceptance: t.status === "COLLECTED" && !t.acceptance,
      addExpense: t.status !== "CLOSED" && t.status !== "CANCELLED",
      recordPayment: t.status === "ACCEPTED" || t.status === "AWAITING_PAYMENT" || (t.status === "CLOSED" && hasOverpaid),
      close: t.status === "ACCEPTED" || t.status === "AWAITING_PAYMENT",
      correct: t.status === "ACCEPTED" || t.status === "AWAITING_PAYMENT" || t.status === "CLOSED",
    },
    shareUrl: `${appUrl}/operator/trips/${t.id}`,
  };
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------
export async function loadDirectory(actor: Actor): Promise<OperatorDirectory | null> {
  if (!isOperator(actor)) return null;
  const [shops, collectors, buyers, tariffs, ds] = await Promise.all([
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      include: {
        points: { where: { isActive: true }, include: pointInclude, orderBy: { createdAt: "asc" } },
        users: { where: { isActive: true }, select: { id: true, login: true, name: true }, orderBy: { login: "asc" } },
      },
    }),
    prisma.user.findMany({
      where: { role: "COLLECTOR" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, login: true, _count: { select: { tripsCollected: { where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } } } } },
    }),
    prisma.buyer.findMany({ orderBy: { name: "asc" } }),
    prisma.tariff.findMany({ orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }] }),
    districts(),
  ]);
  return {
    shops: shops.map((s) => ({ id: s.id, name: s.name, contactName: s.contactName, phone: s.phone, points: s.points.map(toPoint), users: s.users })),
    collectors: collectors.map((c) => ({ id: c.id, name: c.name, phone: c.phone, login: c.login, activeTrips: c._count.tripsCollected })),
    buyers: buyers.map(toBuyer),
    tariffs: tariffs.map(toTariff),
    districts: ds,
  };
}

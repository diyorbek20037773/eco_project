// Yig'uvchi ko'rinishlari: faqat o'z reyslari.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { CollectorStopDetail, CollectorToday, CollectorTripDetail, CollectorTripSummary } from "@/server/contract";
import { addDays, tashkentDayRange, tashkentToday } from "@/domain/time";
import type { Actor } from "@/server/services/core";
import { loadSettlement } from "@/server/services/obligations";
import { disputeInclude, stopInclude, toDispute, toStop } from "./dto";

export const collectorTripInclude = {
  buyer: true,
  stops: { where: { status: { not: "REMOVED" } }, orderBy: { sequence: "asc" }, include: stopInclude },
} satisfies Prisma.TripInclude;
type TripRow = Prisma.TripGetPayload<{ include: typeof collectorTripInclude }>;

export function toCollectorTrip(t: TripRow): CollectorTripSummary {
  const stops = t.stops.map(toStop);
  return {
    id: t.id,
    number: t.number,
    status: t.status,
    windowStart: t.windowStart,
    windowEnd: t.windowEnd,
    buyer: { name: t.buyer.name, address: t.buyer.address, phone: t.buyer.phone },
    vehicle: t.vehicle,
    note: t.note,
    stops,
    nextStopId: stops.find((s) => s.status === "PENDING")?.id ?? null,
    doneCount: stops.filter((s) => s.status === "COLLECTED" || s.status === "SKIPPED").length,
    totalCount: stops.length,
    collectedGrams: stops.reduce((sum, s) => sum + (s.effectiveNetGrams ?? 0), 0),
  };
}

export async function loadCollectorToday(actor: Actor, now: Date = new Date()): Promise<CollectorToday | null> {
  if (actor.role !== "COLLECTOR") return null;
  const today = tashkentToday(now);
  const { start, end } = tashkentDayRange(today);
  const tomorrowStart = tashkentDayRange(addDays(today, 1)).start;

  const trips = await prisma.trip.findMany({
    where: {
      collectorId: actor.id,
      OR: [
        { windowStart: { gte: start, lt: end }, status: { not: "CANCELLED" } },
        { windowStart: { lt: start }, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      ],
    },
    orderBy: { windowStart: "asc" },
    include: collectorTripInclude,
  });
  const upcoming = await prisma.trip.findMany({
    where: { collectorId: actor.id, windowStart: { gte: tomorrowStart }, status: { in: ["PLANNED", "IN_PROGRESS"] } },
    orderBy: { windowStart: "asc" },
    take: 20,
    include: collectorTripInclude,
  });
  const disputes = await prisma.dispute.findMany({
    where: { status: "DECIDED", collectorAckAt: null, trip: { collectorId: actor.id } },
    include: { ...disputeInclude, trip: { select: { number: true } }, stop: { select: { request: { select: { point: { select: { name: true } } } } } } },
    orderBy: { decidedAt: "asc" },
  });
  // Faol reyslar oldinda: IN_PROGRESS, PLANNED, keyin qolganlari.
  const rank = (s: string) => (s === "IN_PROGRESS" ? 0 : s === "PLANNED" ? 1 : 2);
  const todays = trips.map(toCollectorTrip).sort((a, b) => rank(a.status) - rank(b.status) || a.windowStart.getTime() - b.windowStart.getTime());
  return {
    today,
    trips: todays,
    upcoming: upcoming.map(toCollectorTrip),
    disputesAwaitingAck: disputes.map((d) => ({ ...toDispute(d), tripNumber: d.trip.number, pointName: d.stop.request.point.name })),
  };
}

export async function loadCollectorTrip(actor: Actor, id: string): Promise<CollectorTripDetail | null> {
  if (actor.role !== "COLLECTOR") return null;
  const t = await prisma.trip.findUnique({ where: { id }, include: collectorTripInclude });
  if (!t || t.collectorId !== actor.id) return null;
  return { ...toCollectorTrip(t), settlement: await loadSettlement(prisma, t.id) };
}

export async function loadCollectorStop(actor: Actor, stopId: string): Promise<CollectorStopDetail | null> {
  if (actor.role !== "COLLECTOR") return null;
  const s = await prisma.tripStop.findUnique({ where: { id: stopId }, include: { ...stopInclude, trip: { select: { id: true, number: true, status: true, collectorId: true } } } });
  if (!s || s.trip.collectorId !== actor.id || s.status === "REMOVED") return null;
  return {
    stop: toStop(s),
    trip: { id: s.trip.id, number: s.trip.number, status: s.trip.status },
    canRecord: s.status === "PENDING" && (s.trip.status === "PLANNED" || s.trip.status === "IN_PROGRESS"),
  };
}

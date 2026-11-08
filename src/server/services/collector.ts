// Yig'uvchi amallari: bekatda tortish (brutto/tara/rasm) va qoldirish.
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult, RecordWeighingInput } from "@/server/contract";
import { conflict, fieldError, invalidTransition, notFound } from "@/domain/errors";
import { NET_ERROR_TEXT, computeNet, parseKgToGrams } from "@/domain/weight";
import {
  audit,
  idempotent,
  moveRequest,
  moveStop,
  moveTrip,
  ok,
  parseInput,
  requireRole,
  run,
  withTx,
  zClientKey,
  zId,
  zRequiredText,
  type Actor,
  type Tx,
} from "./core";
import { linkAttachments } from "./upload";
import { settleTripProgress } from "./obligations";

const ACTIVE_TRIP = ["PLANNED", "IN_PROGRESS"] as const;

async function nextPendingStopId(tx: Tx | typeof prisma, tripId: string): Promise<string | null> {
  const next = await tx.tripStop.findFirst({ where: { tripId, status: "PENDING" }, orderBy: { sequence: "asc" }, select: { id: true } });
  return next?.id ?? null;
}

async function loadOwnStop(actor: Actor, stopId: string) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    include: { trip: { select: { id: true, status: true, collectorId: true } }, weighing: true },
  });
  if (!stop || stop.trip.collectorId !== actor.id) throw notFound();
  return stop;
}

/** Brutto/tara matnini tekshirib sof vaznni hisoblaydi. */
export function parseWeighing(grossKg: string, tareKg: string | undefined): { grossGrams: number; tareGrams: number; netGrams: number } {
  const grossGrams = parseKgToGrams(grossKg);
  if (grossGrams === null) throw fieldError("grossKg", "Brutto vaznni kg’da kiriting, masalan 185 yoki 185,5.");
  const tareText = (tareKg ?? "").trim();
  const tareGrams = tareText === "" ? 0 : parseKgToGrams(tareText);
  if (tareGrams === null) throw fieldError("tareKg", "Tarani kg’da kiriting yoki bo‘sh qoldiring.");
  const net = computeNet(grossGrams, tareGrams);
  if (!net.ok) {
    const field = net.error === "GROSS_REQUIRED" || net.error === "GROSS_TOO_LARGE" ? "grossKg" : "tareKg";
    throw fieldError(field, NET_ERROR_TEXT[net.error]);
  }
  return { grossGrams, tareGrams, netGrams: net.netGrams };
}

const weighSchema = z.object({
  stopId: zId,
  clientKey: zClientKey,
  grossKg: z.string({ error: "Brutto vaznni kiriting." }).max(20),
  tareKg: z.string().max(20).optional(),
  photoAttachmentId: zId.optional().or(z.literal("").transform(() => undefined)),
});

export async function recordWeighing(
  actorIn: Actor | null,
  raw: RecordWeighingInput,
): Promise<ActionResult<{ netGrams: number; nextStopId: string | null }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "COLLECTOR");
    const input = parseInput(weighSchema, raw);
    const stop = await loadOwnStop(actor, input.stopId);

    const find = async () => {
      const w = await prisma.weighing.findUnique({ where: { clientKey: input.clientKey } });
      if (!w) return null;
      if (w.stopId !== stop.id) throw conflict();
      return ok({ netGrams: w.netGrams, nextStopId: await nextPendingStopId(prisma, stop.tripId) }, { replayed: true });
    };

    return idempotent(find, async () => {
      if (stop.weighing) throw invalidTransition("Bu bekat allaqachon tortilgan.");
      if (stop.status === "SKIPPED") throw invalidTransition("Bu bekat qoldirilgan. Tortib bo‘lmaydi.");
      if (stop.status !== "PENDING") throw invalidTransition("Bu bekatda tortish kiritib bo‘lmaydi.");
      if (!ACTIVE_TRIP.includes(stop.trip.status as (typeof ACTIVE_TRIP)[number])) throw invalidTransition("Reys faol emas.");
      const w = parseWeighing(input.grossKg, input.tareKg);

      const nextStopId = await withTx(async (tx) => {
        if (stop.trip.status === "PLANNED") {
          await tx.trip.updateMany({ where: { id: stop.tripId, status: "PLANNED" }, data: { status: "IN_PROGRESS", version: { increment: 1 } } });
        }
        const now = new Date();
        await moveStop(tx, stop.id, ["PENDING"], "COLLECTED", { collectedAt: now }, "Bekat holati o‘zgargan. Sahifani yangilang.");
        await moveRequest(tx, stop.requestId, ["PLANNED"], "COLLECTED");
        const weighing = await tx.weighing.create({
          data: { stopId: stop.id, grossGrams: w.grossGrams, tareGrams: w.tareGrams, netGrams: w.netGrams, clientKey: input.clientKey, recordedById: actor.id, recordedAt: now },
        });
        if (input.photoAttachmentId) await linkAttachments(tx, actor.id, [input.photoAttachmentId], "SCALE_PHOTO", { weighingId: weighing.id });
        await audit(tx, {
          actorId: actor.id,
          action: "STOP_COLLECTED",
          entityType: "Weighing",
          entityId: weighing.id,
          tripId: stop.tripId,
          after: { stopId: stop.id, ...w, photo: !!input.photoAttachmentId },
        });
        await settleTripProgress(tx, stop.tripId, actor.id);
        return nextPendingStopId(tx, stop.tripId);
      });
      return ok({ netGrams: w.netGrams, nextStopId }, { message: "Vazn saqlandi." });
    });
  });
}

const skipSchema = z.object({
  stopId: zId,
  reason: zRequiredText(3, 300, "Qoldirish sababini yozing."),
});

export async function skipStop(actorIn: Actor | null, raw: { stopId: string; reason: string }): Promise<ActionResult<{ nextStopId: string | null }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "COLLECTOR");
    const input = parseInput(skipSchema, raw);
    const stop = await loadOwnStop(actor, input.stopId);
    if (stop.status === "SKIPPED") return ok({ nextStopId: await nextPendingStopId(prisma, stop.tripId) }, { replayed: true });
    if (stop.status !== "PENDING") throw invalidTransition("Bu bekatni qoldirib bo‘lmaydi: u allaqachon olingan.");
    if (!ACTIVE_TRIP.includes(stop.trip.status as (typeof ACTIVE_TRIP)[number])) throw invalidTransition("Reys faol emas.");

    const nextStopId = await withTx(async (tx) => {
      if (stop.trip.status === "PLANNED") {
        await moveTrip(tx, stop.tripId, ["PLANNED"], "IN_PROGRESS").catch(async () => {
          // parallel amal reysni allaqachon IN_PROGRESS qilgan bo'lishi mumkin
          const t = await tx.trip.findUniqueOrThrow({ where: { id: stop.tripId }, select: { status: true } });
          if (t.status !== "IN_PROGRESS") throw invalidTransition("Reys faol emas.");
        });
      }
      await moveStop(tx, stop.id, ["PENDING"], "SKIPPED", { skipReason: input.reason, skippedAt: new Date(), activeRequestKey: null });
      await moveRequest(tx, stop.requestId, ["PLANNED"], "SKIPPED");
      await audit(tx, {
        actorId: actor.id,
        action: "STOP_SKIPPED",
        entityType: "TripStop",
        entityId: stop.id,
        tripId: stop.tripId,
        reason: input.reason,
        before: { status: "PENDING" },
        after: { status: "SKIPPED" },
      });
      await settleTripProgress(tx, stop.tripId, actor.id);
      return nextPendingStopId(tx, stop.tripId);
    });
    return ok({ nextStopId }, { message: "Bekat qoldirildi. Operator qayta rejalashtiradi." });
  });
}

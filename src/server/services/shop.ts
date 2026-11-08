// Do'kon amallari: buyurtma yaratish/bekor qilish, vaznni tasdiqlash/e'tiroz, bahs qaroriga rozilik.
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult, CreatePickupRequestInput, DisputeStatus } from "@/server/contract";
import { conflict, fieldError, invalidTransition, notFound, validation } from "@/domain/errors";
import { addDays, tashkentToUtc, tashkentToday } from "@/domain/time";
import { MAX_STOP_GRAMS, parseKgToGrams } from "@/domain/weight";
import {
  audit,
  idempotent,
  lockRow,
  moveDispute,
  moveRequest,
  ok,
  okEmpty,
  parseInput,
  requireRole,
  run,
  withTx,
  zClientKey,
  zDate,
  zId,
  zOptText,
  zRequiredText,
  zTime,
  type Actor,
} from "./core";
import { linkAttachments } from "./upload";
import { recomputeObligations } from "./obligations";

const MAX_DAYS_AHEAD = 30;

function requireShop(actorIn: Actor | null): Actor & { shopId: string } {
  const actor = requireRole(actorIn, "SHOP");
  if (!actor.shopId) throw notFound("Akkauntingiz do‘konga biriktirilmagan. Operatorga murojaat qiling.");
  return actor as Actor & { shopId: string };
}

/** kg matnini grammga o'tkazadi; bo'sh → null; noto'g'ri → VALIDATION. */
export function parseOptionalKg(field: string, value: string | undefined, label = "Vazn"): number | null {
  if (value === undefined || value.trim() === "") return null;
  const g = parseKgToGrams(value);
  if (g === null) throw fieldError(field, `${label}ni kg’da kiriting, masalan 45 yoki 45,5.`);
  if (g <= 0) throw fieldError(field, `${label} 0 kg’dan katta bo‘lsin.`);
  if (g > MAX_STOP_GRAMS) throw fieldError(field, `${label} juda katta. Kg’da kiritganingizni tekshiring.`);
  return g;
}

// ---------------------------------------------------------------------------
const createSchema = z.object({
  clientKey: zClientKey,
  pointId: zId,
  readyDate: zDate,
  fromTime: zTime,
  toTime: zTime,
  estimatedKg: z.string().max(20).optional(),
  volume: z.enum(["SMALL", "MEDIUM", "LARGE"], { error: "Hajmni tanlang." }).optional(),
  note: zOptText(500, "Izoh"),
  photoAttachmentId: zId.optional().or(z.literal("").transform(() => undefined)),
});

export async function createPickupRequest(actorIn: Actor | null, raw: CreatePickupRequestInput): Promise<ActionResult<{ requestId: string }>> {
  return run(async () => {
    const actor = requireShop(actorIn);
    const input = parseInput(createSchema, raw);

    const find = async () => {
      const ex = await prisma.pickupRequest.findUnique({ where: { clientKey: input.clientKey }, select: { id: true, createdById: true } });
      if (!ex) return null;
      if (ex.createdById !== actor.id) throw conflict();
      return ok({ requestId: ex.id }, { replayed: true });
    };

    return idempotent(find, async () => {
      const point = await prisma.point.findFirst({ where: { id: input.pointId, shopId: actor.shopId, isActive: true } });
      if (!point) throw fieldError("pointId", "Nuqta topilmadi. Ro‘yxatdan tanlang.");

      const today = tashkentToday();
      if (input.readyDate < today) throw fieldError("readyDate", "O‘tgan sanani tanlab bo‘lmaydi.");
      if (input.readyDate > addDays(today, MAX_DAYS_AHEAD)) throw fieldError("readyDate", `Sana ${MAX_DAYS_AHEAD} kundan uzoq bo‘lmasin.`);
      const readyFrom = tashkentToUtc(input.readyDate, input.fromTime);
      const readyTo = tashkentToUtc(input.readyDate, input.toTime);
      if (!readyFrom || !readyTo) throw fieldError("readyDate", "Sana yoki vaqt noto‘g‘ri.");
      if (readyTo <= readyFrom) throw fieldError("toTime", "Tugash vaqti boshlanishidan keyin bo‘lsin.");

      const estimatedGrams = parseOptionalKg("estimatedKg", input.estimatedKg, "Taxminiy vazn");
      if (estimatedGrams === null && !input.volume) {
        throw validation("Taxminiy vazn yoki hajmni belgilang.", { volume: "Tarozi bo‘lmasa, taxminiy hajmni tanlang." });
      }

      const requestId = await withTx(async (tx) => {
        const req = await tx.pickupRequest.create({
          data: {
            shopId: actor.shopId,
            pointId: point.id,
            createdById: actor.id,
            readyFrom,
            readyTo,
            estimatedGrams,
            volume: input.volume ?? null,
            note: input.note ?? null,
            clientKey: input.clientKey,
          },
        });
        if (input.photoAttachmentId) await linkAttachments(tx, actor.id, [input.photoAttachmentId], "REQUEST_PHOTO", { requestId: req.id });
        await audit(tx, {
          actorId: actor.id,
          action: "REQUEST_CREATED",
          entityType: "PickupRequest",
          entityId: req.id,
          after: { number: req.number, pointId: point.id, readyFrom, readyTo, estimatedGrams, volume: req.volume },
        });
        return req.id;
      });
      return ok({ requestId }, { message: "Buyurtma qabul qilindi." });
    });
  });
}

// ---------------------------------------------------------------------------
const cancelSchema = z.object({ requestId: zId, reason: zOptText(300, "Sabab") });

export async function cancelPickupRequest(actorIn: Actor | null, raw: { requestId: string; reason?: string }): Promise<ActionResult> {
  return run(async () => {
    const actor = requireRole(actorIn, "SHOP", "OPERATOR");
    const input = parseInput(cancelSchema, raw);
    const req = await prisma.pickupRequest.findUnique({ where: { id: input.requestId } });
    if (!req || (actor.role === "SHOP" && req.shopId !== actor.shopId)) throw notFound();
    if (req.status === "CANCELLED") return okEmpty({ replayed: true });
    if (req.status !== "NEW" && req.status !== "SKIPPED") {
      throw invalidTransition("Reysga kiritilgan yoki olingan buyurtmani bekor qilib bo‘lmaydi.");
    }
    await withTx(async (tx) => {
      await moveRequest(tx, req.id, ["NEW", "SKIPPED"], "CANCELLED", { cancelReason: input.reason ?? null }, "Buyurtma holati o‘zgargan. Sahifani yangilang.");
      await audit(tx, {
        actorId: actor.id,
        action: "REQUEST_CANCELLED",
        entityType: "PickupRequest",
        entityId: req.id,
        reason: input.reason ?? null,
        before: { status: req.status },
        after: { status: "CANCELLED" },
      });
    });
    return okEmpty({ message: "Buyurtma bekor qilindi." });
  });
}

// ---------------------------------------------------------------------------
async function loadOwnCollectedStop(actor: Actor & { shopId: string }, stopId: string) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    include: {
      request: { select: { id: true, shopId: true, status: true } },
      trip: { select: { id: true, status: true } },
      confirmation: true,
      weighing: { select: { netGrams: true } },
    },
  });
  if (!stop || stop.request.shopId !== actor.shopId) throw notFound();
  return stop;
}

const stopSchema = z.object({ stopId: zId });

export async function confirmStopWeight(actorIn: Actor | null, raw: { stopId: string }): Promise<ActionResult> {
  return run(async () => {
    const actor = requireShop(actorIn);
    const { stopId } = parseInput(stopSchema, raw);
    const stop = await loadOwnCollectedStop(actor, stopId);
    if (stop.confirmation?.status === "CONFIRMED") return okEmpty({ replayed: true });
    if (stop.confirmation?.status === "DISPUTED") throw invalidTransition("Bu vazn bo‘yicha e’tiroz bildirilgan. Bahs qarorini kuting.");
    if (stop.status !== "COLLECTED" || !stop.weighing) throw invalidTransition("Vazn hali kiritilmagan.");
    if (stop.trip.status === "CANCELLED" || stop.trip.status === "CLOSED") throw invalidTransition("Reys yopilgan.");

    return idempotent(
      async () => {
        const c = await prisma.shopConfirmation.findUnique({ where: { stopId } });
        if (!c) return null;
        if (c.status !== "CONFIRMED") throw invalidTransition("Bu vazn bo‘yicha e’tiroz bildirilgan.");
        return okEmpty({ replayed: true });
      },
      async () => {
        await withTx(async (tx) => {
          await tx.shopConfirmation.create({ data: { stopId, status: "CONFIRMED", userId: actor.id } });
          await moveRequest(tx, stop.request.id, ["COLLECTED"], "CONFIRMED");
          await audit(tx, {
            actorId: actor.id,
            action: "WEIGHT_CONFIRMED",
            entityType: "TripStop",
            entityId: stopId,
            tripId: stop.tripId,
            after: { netGrams: stop.weighing?.netGrams ?? null },
          });
        });
        return okEmpty({ message: "Vazn tasdiqlandi." });
      },
    );
  });
}

const disputeSchema = z.object({
  stopId: zId,
  reason: zRequiredText(5, 500, "E’tiroz sababini yozing (kamida 5 belgi)."),
  claimedKg: z.string().max(20).optional(),
});

export async function disputeStopWeight(
  actorIn: Actor | null,
  raw: { stopId: string; reason: string; claimedKg?: string },
): Promise<ActionResult<{ disputeId: string }>> {
  return run(async () => {
    const actor = requireShop(actorIn);
    const input = parseInput(disputeSchema, raw);
    const claimedNetGrams = parseOptionalKg("claimedKg", input.claimedKg, "Sizning vazningiz");
    const stop = await loadOwnCollectedStop(actor, input.stopId);

    const find = async () => {
      const c = await prisma.shopConfirmation.findUnique({ where: { stopId: stop.id } });
      if (!c) return null;
      if (c.status === "CONFIRMED") throw invalidTransition("Vazn allaqachon tasdiqlangan.");
      const d = await prisma.dispute.findFirst({ where: { stopId: stop.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (!d) return null;
      return ok({ disputeId: d.id }, { replayed: true });
    };
    const existing = await find();
    if (existing) return existing;
    if (stop.status !== "COLLECTED" || !stop.weighing) throw invalidTransition("Vazn hali kiritilmagan.");
    if (stop.trip.status === "CANCELLED" || stop.trip.status === "CLOSED") throw invalidTransition("Reys yopilgan.");

    return idempotent(find, async () => {
      const disputeId = await withTx(async (tx) => {
        await tx.shopConfirmation.create({ data: { stopId: stop.id, status: "DISPUTED", reason: input.reason, userId: actor.id } });
        await moveRequest(tx, stop.request.id, ["COLLECTED"], "DISPUTED");
        const d = await tx.dispute.create({
          data: {
            tripId: stop.tripId,
            stopId: stop.id,
            openKey: stop.id,
            status: "OPEN",
            reason: input.reason,
            claimedNetGrams,
            openedById: actor.id,
          },
        });
        await audit(tx, {
          actorId: actor.id,
          action: "WEIGHT_DISPUTED",
          entityType: "Dispute",
          entityId: d.id,
          tripId: stop.tripId,
          reason: input.reason,
          after: { stopId: stop.id, weighedNetGrams: stop.weighing?.netGrams ?? null, claimedNetGrams },
        });
        return d.id;
      });
      return ok({ disputeId }, { message: "E’tiroz yuborildi. Operator qarorini kuting." });
    });
  });
}

// ---------------------------------------------------------------------------
const ackSchema = z.object({
  disputeId: zId,
  agree: z.boolean({ error: "Rozimisiz yoki yo‘qmi — tanlang." }),
  comment: zOptText(500, "Izoh"),
});

/** Bahs qaroriga rozilik: do'kon (o'z bekati) yoki yig'uvchi (o'z reysi). */
export async function acknowledgeDispute(
  actorIn: Actor | null,
  raw: { disputeId: string; agree: boolean; comment?: string },
): Promise<ActionResult<{ status: DisputeStatus }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "SHOP", "COLLECTOR");
    const input = parseInput(ackSchema, raw);
    const dispute = await prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: {
        stop: { select: { id: true, request: { select: { id: true, shopId: true } } } },
        trip: { select: { id: true, collectorId: true } },
      },
    });
    if (!dispute) throw notFound();
    const isShop = actor.role === "SHOP" && !!actor.shopId && dispute.stop.request.shopId === actor.shopId;
    const isCollector = actor.role === "COLLECTOR" && dispute.trip.collectorId === actor.id;
    if (!isShop && !isCollector) throw notFound();
    if (!input.agree && (!input.comment || input.comment.length < 3)) {
      throw fieldError("comment", "Nega rozi emasligingizni yozing.");
    }

    const result = await withTx(async (tx) => {
      await lockRow(tx, "Dispute", dispute.id);
      const d = await tx.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
      if (d.status === "RESOLVED") return { status: "RESOLVED" as DisputeStatus, replayed: true };
      if (d.status !== "DECIDED") throw invalidTransition("Operator hali qaror qabul qilmagan.");
      const already = isShop ? d.shopAckAt : d.collectorAckAt;
      if (already && input.agree) return { status: d.status as DisputeStatus, replayed: true };

      if (!input.agree) {
        await moveDispute(tx, d.id, ["DECIDED"], "OPEN", {
          lastRejectComment: input.comment ?? null,
          shopAckAt: null,
          shopAckById: null,
          collectorAckAt: null,
          collectorAckById: null,
        });
        await audit(tx, {
          actorId: actor.id,
          action: "DISPUTE_REJECTED",
          entityType: "Dispute",
          entityId: d.id,
          tripId: d.tripId,
          reason: input.comment ?? null,
          before: { status: "DECIDED", decidedNetGrams: d.decidedNetGrams },
          after: { status: "OPEN", side: isShop ? "SHOP" : "COLLECTOR" },
        });
        return { status: "OPEN" as DisputeStatus, replayed: false };
      }

      const now = new Date();
      const ackData = isShop ? { shopAckAt: now, shopAckById: actor.id } : { collectorAckAt: now, collectorAckById: actor.id };
      await tx.dispute.update({ where: { id: d.id }, data: ackData });
      await audit(tx, {
        actorId: actor.id,
        action: "DISPUTE_ACKNOWLEDGED",
        entityType: "Dispute",
        entityId: d.id,
        tripId: d.tripId,
        after: { side: isShop ? "SHOP" : "COLLECTOR", decidedNetGrams: d.decidedNetGrams },
      });
      const shopAck = isShop ? now : d.shopAckAt;
      const collectorAck = isShop ? d.collectorAckAt : now;
      if (shopAck && collectorAck) {
        await moveDispute(tx, d.id, ["DECIDED"], "RESOLVED", { openKey: null, resolvedAt: now });
        await moveRequest(tx, dispute.stop.request.id, ["DISPUTED"], "CONFIRMED");
        await audit(tx, {
          actorId: actor.id,
          action: "DISPUTE_RESOLVED",
          entityType: "Dispute",
          entityId: d.id,
          tripId: d.tripId,
          before: { status: "DECIDED" },
          after: { status: "RESOLVED", decidedNetGrams: d.decidedNetGrams },
        });
        await recomputeObligations(tx, d.tripId, actor.id, "Bahs hal qilindi");
        return { status: "RESOLVED" as DisputeStatus, replayed: false };
      }
      return { status: "DECIDED" as DisputeStatus, replayed: false };
    });
    return ok(
      { status: result.status },
      {
        replayed: result.replayed,
        message: result.status === "RESOLVED" ? "Bahs hal qilindi." : result.status === "OPEN" ? "E’tirozingiz operatorga qaytarildi." : "Roziligingiz qayd etildi.",
      },
    );
  });
}

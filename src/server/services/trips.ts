// Operator amallari: reys tuzish/tahrir/bekor, bahs qarori, xaridor qabuli, xarajat,
// to'lov, yopish va yopilgan yozuvni tuzatish.
import { z } from "zod";
import { prisma } from "@/lib/db";
import type {
  ActionResult,
  AddExpenseInput,
  CloseCheck,
  CorrectionInput,
  CreateTripInput,
  RecordAcceptanceInput,
  RecordPaymentInput,
  TripStatus,
} from "@/server/contract";
import { conflict, fieldError, invalidTransition, notFound, overpayment, validation } from "@/domain/errors";
import { CLOSE_CHECK_MISSING, checkPayment, evaluateCloseChecks, paidAmount } from "@/domain/settlement";
import { tashkentToUtc } from "@/domain/time";
import { formatSom } from "@/lib/format";
import {
  audit,
  idempotent,
  lockRow,
  moveDispute,
  moveRequest,
  moveStop,
  moveTrip,
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
  zSom,
  zTime,
  type Actor,
  type Tx,
} from "./core";
import { linkAttachments } from "./upload";
import { loadBalances, loadDeliveredStops, recomputeObligations } from "./obligations";
import { parseOptionalKg } from "./shop";
import { parseWeighing } from "./collector";

const MAX_STOPS = 30;

function requireOperator(actor: Actor | null): Actor {
  return requireRole(actor, "OPERATOR");
}

// ---------------------------------------------------------------------------
// Reys tuzish
// ---------------------------------------------------------------------------
const createTripSchema = z.object({
  clientKey: zClientKey,
  requestIds: z.array(zId).min(1, "Kamida bitta buyurtmani tanlang.").max(MAX_STOPS, `Bitta reysda ko‘pi bilan ${MAX_STOPS} bekat.`),
  collectorId: zId,
  buyerId: zId,
  date: zDate,
  fromTime: zTime,
  toTime: zTime,
  shopPricePerKg: zSom("Do‘kon narxi"),
  buyerPricePerKg: zSom("Xaridor narxi"),
  serviceFee: zSom("Xizmat haqi"),
  vehicle: zOptText(120, "Transport"),
  note: zOptText(500, "Izoh"),
});

export async function currentTariff(db: Tx | typeof prisma = prisma, at: Date = new Date()) {
  return db.tariff.findFirst({ where: { validFrom: { lte: at } }, orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }] });
}

export async function createTrip(actorIn: Actor | null, raw: CreateTripInput): Promise<ActionResult<{ tripId: string }>> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(createTripSchema, raw);

    const find = async () => {
      const t = await prisma.trip.findUnique({ where: { clientKey: input.clientKey }, select: { id: true } });
      return t ? ok({ tripId: t.id }, { replayed: true }) : null;
    };

    return idempotent(find, async () => {
      if (new Set(input.requestIds).size !== input.requestIds.length) throw fieldError("requestIds", "Bitta buyurtma ikki marta tanlangan.");
      const windowStart = tashkentToUtc(input.date, input.fromTime);
      const windowEnd = tashkentToUtc(input.date, input.toTime);
      if (!windowStart || !windowEnd) throw fieldError("date", "Sana yoki vaqt noto‘g‘ri.");
      if (windowEnd <= windowStart) throw fieldError("toTime", "Tugash vaqti boshlanishidan keyin bo‘lsin.");

      const collector = await prisma.user.findFirst({ where: { id: input.collectorId, role: "COLLECTOR", isActive: true } });
      if (!collector) throw fieldError("collectorId", "Yig‘uvchini tanlang.");
      const buyer = await prisma.buyer.findFirst({ where: { id: input.buyerId, isActive: true } });
      if (!buyer) throw fieldError("buyerId", "Xaridorni tanlang.");

      const requests = await prisma.pickupRequest.findMany({ where: { id: { in: input.requestIds } }, select: { id: true, status: true, number: true } });
      if (requests.length !== input.requestIds.length) throw fieldError("requestIds", "Ba’zi buyurtmalar topilmadi. Navbatni yangilang.");
      const busy = requests.filter((r) => r.status !== "NEW" && r.status !== "SKIPPED");
      if (busy.length > 0) {
        throw invalidTransition(`#${busy.map((r) => r.number).join(", #")} buyurtma allaqachon reysga kiritilgan yoki yopilgan. Navbatni yangilang.`);
      }

      const tripId = await withTx(async (tx) => {
        const tariff = await currentTariff(tx);
        const trip = await tx.trip.create({
          data: {
            windowStart,
            windowEnd,
            collectorId: collector.id,
            buyerId: buyer.id,
            tariffId: tariff?.id ?? null,
            shopPricePerKg: input.shopPricePerKg,
            buyerPricePerKg: input.buyerPricePerKg,
            serviceFee: input.serviceFee,
            vehicle: input.vehicle ?? null,
            note: input.note ?? null,
            clientKey: input.clientKey,
            createdById: actor.id,
          },
        });
        let seq = 1;
        for (const requestId of input.requestIds) {
          await moveRequest(tx, requestId, ["NEW", "SKIPPED"], "PLANNED", {}, "Buyurtma boshqa reysga kiritilgan. Navbatni yangilang.");
          await tx.tripStop.create({ data: { tripId: trip.id, requestId, sequence: seq++, activeRequestKey: requestId } });
        }
        await audit(tx, {
          actorId: actor.id,
          action: "TRIP_CREATED",
          entityType: "Trip",
          entityId: trip.id,
          tripId: trip.id,
          after: {
            number: trip.number,
            requestIds: input.requestIds,
            collectorId: collector.id,
            buyerId: buyer.id,
            windowStart,
            windowEnd,
            prices: { shopPricePerKg: trip.shopPricePerKg, buyerPricePerKg: trip.buyerPricePerKg, serviceFee: trip.serviceFee, tariffId: trip.tariffId },
            minBatchGrams: buyer.minBatchGrams,
          },
        });
        return trip.id;
      });
      return ok({ tripId }, { message: "Reys yaratildi." });
    });
  });
}

// ---------------------------------------------------------------------------
const reorderSchema = z.object({
  tripId: zId,
  requestIds: z.array(zId).min(1, "Kamida bitta bekat qolsin. Reysni bekor qilish uchun «Bekor qilish»ni bosing.").max(MAX_STOPS),
});

export async function reorderTripStops(actorIn: Actor | null, raw: { tripId: string; requestIds: string[] }): Promise<ActionResult> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(reorderSchema, raw);
    if (new Set(input.requestIds).size !== input.requestIds.length) throw fieldError("requestIds", "Bitta buyurtma ikki marta berilgan.");
    await withTx(async (tx) => {
      if (!(await lockRow(tx, "Trip", input.tripId))) throw notFound();
      const trip = await tx.trip.findUniqueOrThrow({ where: { id: input.tripId }, include: { stops: { where: { status: "PENDING" }, orderBy: { sequence: "asc" } } } });
      if (trip.status !== "PLANNED") throw invalidTransition("Faqat boshlanmagan reys tartibini o‘zgartirish mumkin.");
      const byRequest = new Map(trip.stops.map((s) => [s.requestId, s]));
      for (const id of input.requestIds) if (!byRequest.has(id)) throw fieldError("requestIds", "Ro‘yxatda shu reysga tegishli bo‘lmagan buyurtma bor.");
      const before = trip.stops.map((s) => s.requestId);
      const keep = new Set(input.requestIds);
      for (const s of trip.stops) {
        if (!keep.has(s.requestId)) {
          await moveStop(tx, s.id, ["PENDING"], "REMOVED", { activeRequestKey: null });
          await moveRequest(tx, s.requestId, ["PLANNED"], "NEW");
        }
      }
      let seq = 1;
      for (const id of input.requestIds) {
        const s = byRequest.get(id)!;
        if (s.sequence !== seq) await tx.tripStop.update({ where: { id: s.id }, data: { sequence: seq } });
        seq++;
      }
      await tx.trip.update({ where: { id: trip.id }, data: { version: { increment: 1 } } });
      await audit(tx, {
        actorId: actor.id,
        action: "TRIP_STOPS_REORDERED",
        entityType: "Trip",
        entityId: trip.id,
        tripId: trip.id,
        before: { requestIds: before },
        after: { requestIds: input.requestIds },
      });
    });
    return okEmpty({ message: "Bekatlar tartibi saqlandi." });
  });
}

const cancelTripSchema = z.object({ tripId: zId, reason: zRequiredText(3, 300, "Bekor qilish sababini yozing.") });

export async function cancelTrip(actorIn: Actor | null, raw: { tripId: string; reason: string }): Promise<ActionResult> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(cancelTripSchema, raw);
    const trip = await prisma.trip.findUnique({ where: { id: input.tripId }, select: { id: true, status: true } });
    if (!trip) throw notFound();
    if (trip.status === "CANCELLED") return okEmpty({ replayed: true });
    if (trip.status !== "PLANNED") throw invalidTransition("Faqat boshlanmagan reysni bekor qilish mumkin.");
    await withTx(async (tx) => {
      await moveTrip(tx, trip.id, ["PLANNED"], "CANCELLED", { cancelReason: input.reason }, "Reys boshlangan yoki o‘zgargan. Sahifani yangilang.");
      const stops = await tx.tripStop.findMany({ where: { tripId: trip.id, status: "PENDING" } });
      for (const s of stops) {
        await moveStop(tx, s.id, ["PENDING"], "REMOVED", { activeRequestKey: null });
        await moveRequest(tx, s.requestId, ["PLANNED"], "NEW");
      }
      await audit(tx, {
        actorId: actor.id,
        action: "TRIP_CANCELLED",
        entityType: "Trip",
        entityId: trip.id,
        tripId: trip.id,
        reason: input.reason,
        before: { status: "PLANNED" },
        after: { status: "CANCELLED", releasedRequests: stops.map((s) => s.requestId) },
      });
    });
    return okEmpty({ message: "Reys bekor qilindi. Buyurtmalar navbatga qaytdi." });
  });
}

// ---------------------------------------------------------------------------
// Bahs qarori
// ---------------------------------------------------------------------------
const decideSchema = z.object({
  disputeId: zId,
  decisionText: zRequiredText(5, 1000, "Qaror matnini yozing (kamida 5 belgi)."),
  decidedKg: z.string({ error: "Yakuniy vaznni kiriting." }).max(20),
});

export async function decideDispute(actorIn: Actor | null, raw: { disputeId: string; decisionText: string; decidedKg: string }): Promise<ActionResult> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(decideSchema, raw);
    const decidedNetGrams = parseOptionalKg("decidedKg", input.decidedKg, "Yakuniy vazn");
    if (decidedNetGrams === null) throw fieldError("decidedKg", "Yakuniy vaznni kg’da kiriting.");
    const d = await prisma.dispute.findUnique({ where: { id: input.disputeId } });
    if (!d) throw notFound();
    if (d.status !== "OPEN") throw invalidTransition(d.status === "DECIDED" ? "Qaror allaqachon qabul qilingan, tomonlar javobini kuting." : "Bahs allaqachon hal qilingan.");
    await withTx(async (tx) => {
      await moveDispute(tx, d.id, ["OPEN"], "DECIDED", {
        decisionText: input.decisionText,
        decidedNetGrams,
        decidedById: actor.id,
        decidedAt: new Date(),
        shopAckAt: null,
        shopAckById: null,
        collectorAckAt: null,
        collectorAckById: null,
      });
      await audit(tx, {
        actorId: actor.id,
        action: "DISPUTE_DECIDED",
        entityType: "Dispute",
        entityId: d.id,
        tripId: d.tripId,
        reason: input.decisionText,
        before: { status: "OPEN", claimedNetGrams: d.claimedNetGrams },
        after: { status: "DECIDED", decidedNetGrams },
      });
    });
    return okEmpty({ message: "Qaror saqlandi. Do‘kon va yig‘uvchi roziligi kutilmoqda." });
  });
}

// ---------------------------------------------------------------------------
// Xaridor qabuli
// ---------------------------------------------------------------------------
const acceptanceSchema = z.object({
  tripId: zId,
  clientKey: zClientKey,
  acceptedKg: z.string({ error: "Qabul vaznini kiriting." }).max(20),
  quality: z.enum(["GOOD", "ACCEPTABLE", "POOR"], { error: "Sifatni tanlang." }),
  qualityNote: zOptText(500, "Sifat izohi"),
  discrepancyReason: zOptText(500, "Tafovut sababi"),
  decision: z.enum(["TRIP_ABSORBS", "OTHER"], { error: "Operator qarorini tanlang." }).optional(),
  decisionNote: zOptText(500, "Qaror izohi"),
  buyerPricePerKg: zSom("Xaridor narxi"),
  buyerReference: zRequiredText(2, 200, "Xaridor tasdig‘ini kiriting: nakladnoy raqami yoki qabul qilgan shaxs."),
  acceptedDate: zDate,
  acceptedTime: zTime,
  documentAttachmentIds: z.array(zId).max(10).optional(),
});

export async function recordAcceptance(actorIn: Actor | null, raw: RecordAcceptanceInput): Promise<ActionResult<{ discrepancyGrams: number }>> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(acceptanceSchema, raw);
    const trip = await prisma.trip.findUnique({ where: { id: input.tripId }, select: { id: true, status: true } });
    if (!trip) throw notFound();

    const find = async () => {
      const a = await prisma.buyerAcceptance.findUnique({ where: { clientKey: input.clientKey } });
      if (!a) return null;
      if (a.tripId !== trip.id) throw conflict();
      return ok({ discrepancyGrams: a.discrepancyGrams }, { replayed: true });
    };

    return idempotent(find, async () => {
      const acceptedGrams = parseOptionalKg("acceptedKg", input.acceptedKg, "Qabul vazni");
      if (acceptedGrams === null) throw fieldError("acceptedKg", "Qabul vaznini kg’da kiriting.");
      const acceptedAt = tashkentToUtc(input.acceptedDate, input.acceptedTime);
      if (!acceptedAt) throw fieldError("acceptedDate", "Sana yoki vaqt noto‘g‘ri.");
      if (acceptedAt.getTime() > Date.now() + 10 * 60 * 1000) throw fieldError("acceptedDate", "Qabul vaqti kelajakda bo‘lmaydi.");
      if (trip.status !== "COLLECTED") {
        throw invalidTransition(
          trip.status === "PLANNED" || trip.status === "IN_PROGRESS"
            ? "Barcha bekatlar olinmaguncha xaridor qabulini kiritib bo‘lmaydi."
            : "Bu reys uchun xaridor qabuli allaqachon kiritilgan yoki reys yopilgan.",
        );
      }

      const result = await withTx(async (tx) => {
        if (!(await lockRow(tx, "Trip", trip.id))) throw notFound();
        const delivered = await loadDeliveredStops(tx, trip.id);
        const deliveredGrams = delivered.reduce((s, x) => s + x.netGrams, 0);
        const discrepancyGrams = acceptedGrams - deliveredGrams;
        if (discrepancyGrams !== 0) {
          const fe: Record<string, string> = {};
          if (!input.discrepancyReason || input.discrepancyReason.length < 3) fe.discrepancyReason = "Tafovut bor: sababini yozing.";
          if (!input.decision) fe.decision = "Tafovut bor: operator qarorini tanlang.";
          if (input.decision === "OTHER" && (!input.decisionNote || input.decisionNote.length < 3)) fe.decisionNote = "Qaror izohini yozing.";
          if (Object.keys(fe).length) throw validation(Object.values(fe)[0], fe);
        }
        await moveTrip(tx, trip.id, ["COLLECTED"], "ACCEPTED", {}, "Reys holati o‘zgargan. Sahifani yangilang.");
        const acc = await tx.buyerAcceptance.create({
          data: {
            tripId: trip.id,
            acceptedGrams,
            deliveredGrams,
            discrepancyGrams,
            quality: input.quality,
            qualityNote: input.qualityNote ?? null,
            discrepancyReason: input.discrepancyReason ?? null,
            decision: discrepancyGrams !== 0 ? (input.decision ?? null) : null,
            decisionNote: discrepancyGrams !== 0 ? (input.decisionNote ?? null) : null,
            buyerPricePerKg: input.buyerPricePerKg,
            buyerReference: input.buyerReference,
            clientKey: input.clientKey,
            acceptedAt,
            recordedById: actor.id,
          },
        });
        if (input.documentAttachmentIds?.length) {
          await linkAttachments(tx, actor.id, input.documentAttachmentIds, "ACCEPTANCE_DOC", { acceptanceId: acc.id });
        }
        await audit(tx, {
          actorId: actor.id,
          action: "ACCEPTANCE_RECORDED",
          entityType: "BuyerAcceptance",
          entityId: acc.id,
          tripId: trip.id,
          reason: acc.discrepancyReason,
          after: {
            acceptedGrams,
            deliveredGrams,
            discrepancyGrams,
            quality: acc.quality,
            decision: acc.decision,
            buyerPricePerKg: acc.buyerPricePerKg,
            buyerReference: acc.buyerReference,
          },
        });
        await recomputeObligations(tx, trip.id, actor.id);
        return discrepancyGrams;
      });
      return ok({ discrepancyGrams: result }, { message: "Xaridor qabuli saqlandi. Majburiyatlar hisoblandi." });
    });
  });
}

// ---------------------------------------------------------------------------
// Xarajat
// ---------------------------------------------------------------------------
const PARTY = z.enum(["ECO_POINT", "COLLECTOR", "BUYER", "SHOP", "OTHER"], { error: "Kim to‘laganini tanlang." });
const expenseSchema = z.object({
  tripId: zId,
  clientKey: zClientKey,
  type: z.enum(["TRANSPORT", "LOADING", "OTHER"], { error: "Xarajat turini tanlang." }),
  amount: zSom("Xarajat summasi").refine((n) => n > 0, "Xarajat summasi 0 dan katta bo‘lsin."),
  payer: PARTY,
  recipient: zOptText(200, "Oluvchi"),
  note: zOptText(500, "Izoh"),
});

export async function addExpense(actorIn: Actor | null, raw: AddExpenseInput): Promise<ActionResult<{ expenseId: string }>> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(expenseSchema, raw);
    const trip = await prisma.trip.findUnique({ where: { id: input.tripId }, select: { id: true, status: true } });
    if (!trip) throw notFound();
    const find = async () => {
      const e = await prisma.expense.findUnique({ where: { clientKey: input.clientKey } });
      if (!e) return null;
      if (e.tripId !== trip.id) throw conflict();
      return ok({ expenseId: e.id }, { replayed: true });
    };
    return idempotent(find, async () => {
      if (trip.status === "CLOSED" || trip.status === "CANCELLED") {
        throw invalidTransition("Yopilgan yoki bekor qilingan reysga xarajat qo‘shib bo‘lmaydi. Kerak bo‘lsa tuzatish kiriting.");
      }
      const expenseId = await withTx(async (tx) => {
        if (!(await lockRow(tx, "Trip", trip.id))) throw notFound();
        const t = await tx.trip.findUniqueOrThrow({ where: { id: trip.id }, select: { status: true } });
        if (t.status === "CLOSED" || t.status === "CANCELLED") throw invalidTransition("Reys yopilgan.");
        const e = await tx.expense.create({
          data: {
            tripId: trip.id,
            type: input.type,
            amount: input.amount,
            payer: input.payer,
            recipient: input.recipient ?? null,
            note: input.note ?? null,
            clientKey: input.clientKey,
            createdById: actor.id,
          },
        });
        await audit(tx, {
          actorId: actor.id,
          action: "EXPENSE_ADDED",
          entityType: "Expense",
          entityId: e.id,
          tripId: trip.id,
          after: { type: e.type, amount: e.amount, payer: e.payer, recipient: e.recipient },
        });
        return e.id;
      });
      return ok({ expenseId }, { message: "Xarajat qo‘shildi." });
    });
  });
}

// ---------------------------------------------------------------------------
// To'lov (haqiqatda tushgan pul qaydi)
// ---------------------------------------------------------------------------
const paymentSchema = z.object({
  obligationId: zId,
  clientKey: zClientKey,
  kind: z.enum(["PAYMENT", "REFUND"]).optional(),
  amount: zSom("To‘lov summasi").refine((n) => n > 0, "To‘lov summasi 0 dan katta bo‘lsin."),
  paidDate: zDate,
  method: zOptText(60, "To‘lov usuli"),
  reference: zOptText(200, "Izoh/raqam"),
});

const PAYABLE: readonly TripStatus[] = ["ACCEPTED", "AWAITING_PAYMENT", "CLOSED"];

export async function recordPayment(actorIn: Actor | null, raw: RecordPaymentInput): Promise<ActionResult<{ paymentId: string; remaining: number }>> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(paymentSchema, raw);
    const kind = input.kind ?? "PAYMENT";
    const obligation = await prisma.obligation.findUnique({ where: { id: input.obligationId }, select: { id: true, tripId: true } });
    if (!obligation) throw notFound();

    const find = async () => {
      const p = await prisma.payment.findUnique({ where: { clientKey: input.clientKey } });
      if (!p) return null;
      if (p.obligationId !== obligation.id) throw conflict();
      const o = await prisma.obligation.findUniqueOrThrow({ where: { id: obligation.id }, include: { payments: { select: { kind: true, amount: true } } } });
      return ok({ paymentId: p.id, remaining: o.amount - paidAmount(o.payments) }, { replayed: true });
    };

    return idempotent(find, async () => {
      const paidAt = tashkentToUtc(input.paidDate, "12:00");
      if (!paidAt) throw fieldError("paidDate", "Sanani tanlang.");
      if (paidAt.getTime() > Date.now() + 36 * 60 * 60 * 1000) throw fieldError("paidDate", "To‘lov sanasi kelajakda bo‘lmaydi.");

      const res = await withTx(async (tx) => {
        // Qator qulfi: parallel to'lovlar ketma-ket bajariladi va qoldiq qayta hisoblanadi.
        if (!(await lockRow(tx, "Obligation", obligation.id))) throw notFound();
        const trip = await tx.trip.findUniqueOrThrow({ where: { id: obligation.tripId }, select: { status: true } });
        if (!PAYABLE.includes(trip.status)) throw invalidTransition("To‘lovni xaridor qabulidan keyin kiritish mumkin.");
        const o = await tx.obligation.findUniqueOrThrow({ where: { id: obligation.id }, include: { payments: { select: { kind: true, amount: true } } } });
        const paid = paidAmount(o.payments);
        const check = checkPayment(o.amount, paid, kind, input.amount);
        if (!check.ok) {
          if (check.reason === "NOTHING_TO_REFUND") throw invalidTransition("Ortiqcha to‘lov yo‘q — qaytarish kiritib bo‘lmaydi.");
          const limit = kind === "PAYMENT" ? o.amount - paid : paid - o.amount;
          throw overpayment(
            limit <= 0
              ? "Bu majburiyat to‘liq to‘langan. Takroriy to‘lov kiritilmadi."
              : `Summa qoldiqdan oshib ketdi. Ko‘pi bilan ${formatSom(limit)} kiritish mumkin.`,
          );
        }
        const p = await tx.payment.create({
          data: {
            obligationId: o.id,
            kind,
            amount: input.amount,
            paidAt,
            method: input.method ?? null,
            reference: input.reference ?? null,
            clientKey: input.clientKey,
            recordedById: actor.id,
          },
        });
        await audit(tx, {
          actorId: actor.id,
          action: kind === "PAYMENT" ? "PAYMENT_RECORDED" : "REFUND_RECORDED",
          entityType: "Payment",
          entityId: p.id,
          tripId: obligation.tripId,
          before: { obligationKey: o.key, amount: o.amount, paid },
          after: { amount: input.amount, remaining: check.remainingAfter, paidAt },
        });
        return { paymentId: p.id, remaining: check.remainingAfter };
      });
      return ok(res, { message: res.remaining === 0 ? "To‘lov qayd etildi. Majburiyat to‘liq yopildi." : `To‘lov qayd etildi. Qoldiq: ${formatSom(res.remaining)}.` });
    });
  });
}

// ---------------------------------------------------------------------------
// Yopish
// ---------------------------------------------------------------------------
export async function tripCloseChecks(tx: Tx | typeof prisma, tripId: string): Promise<CloseCheck[]> {
  const trip = await tx.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      acceptance: { select: { id: true } },
      stops: { include: { confirmation: { select: { status: true } }, disputes: { select: { status: true } } } },
      obligations: { include: { payments: { select: { kind: true, amount: true } } } },
    },
  });
  return evaluateCloseChecks({
    stops: trip.stops.map((s) => ({ status: s.status, confirmation: s.confirmation?.status ?? null, disputes: s.disputes })),
    hasAcceptance: !!trip.acceptance,
    obligations: trip.obligations.map((o) => ({ amount: o.amount, paid: paidAmount(o.payments) })),
  });
}

export async function closeTrip(actorIn: Actor | null, raw: { tripId: string }): Promise<ActionResult<{ status: TripStatus; failed: CloseCheck[] }>> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const { tripId } = parseInput(z.object({ tripId: zId }), raw);
    return withTx(async (tx) => {
      if (!(await lockRow(tx, "Trip", tripId))) throw notFound();
      const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId }, select: { id: true, status: true } });
      if (trip.status === "CLOSED") return ok({ status: "CLOSED" as TripStatus, failed: [] }, { replayed: true });
      // To'lovlar bilan poyga bo'lmasin: majburiyat qatorlarini ham qulflaymiz.
      const obIds = await tx.obligation.findMany({ where: { tripId }, select: { id: true }, orderBy: { id: "asc" } });
      for (const o of obIds) await lockRow(tx, "Obligation", o.id);

      const checks = await tripCloseChecks(tx, tripId);
      const failed = checks.filter((c) => !c.ok);
      const blocking = failed.filter((c) => c.key !== "PAID");
      if (trip.status !== "ACCEPTED" && trip.status !== "AWAITING_PAYMENT") {
        throw invalidTransition(
          trip.status === "CANCELLED"
            ? "Bekor qilingan reysni yopib bo‘lmaydi."
            : `Reysni yopib bo‘lmaydi: ${(blocking.length ? blocking : failed).map((c) => CLOSE_CHECK_MISSING[c.key]).join("; ") || "xaridor qabuli kiritilmagan"}.`,
        );
      }
      if (blocking.length > 0) {
        throw invalidTransition(`Reysni yopib bo‘lmaydi: ${blocking.map((c) => CLOSE_CHECK_MISSING[c.key]).join("; ")}.`);
      }
      if (failed.length > 0) {
        if (trip.status === "ACCEPTED") {
          await moveTrip(tx, tripId, ["ACCEPTED"], "AWAITING_PAYMENT");
          await audit(tx, { actorId: actor.id, action: "TRIP_STATUS", entityType: "Trip", entityId: tripId, tripId, before: { status: "ACCEPTED" }, after: { status: "AWAITING_PAYMENT" } });
        }
        return ok({ status: "AWAITING_PAYMENT" as TripStatus, failed }, { message: "Shartlar bajarildi, lekin to‘lov qoldi. Reys «To‘lov kutilmoqda» holatida." });
      }
      await moveTrip(tx, tripId, ["ACCEPTED", "AWAITING_PAYMENT"], "CLOSED", { closedAt: new Date() });
      // Tuzatishdan keyin qayta yopishda buyurtmalar allaqachon SETTLED bo'ladi.
      const stops = await tx.tripStop.findMany({ where: { tripId, status: "COLLECTED" }, select: { requestId: true } });
      await tx.pickupRequest.updateMany({ where: { id: { in: stops.map((s) => s.requestId) }, status: "CONFIRMED" }, data: { status: "SETTLED" } });
      const unsettled = await tx.pickupRequest.count({ where: { id: { in: stops.map((s) => s.requestId) }, status: { not: "SETTLED" } } });
      if (unsettled > 0) throw invalidTransition("Ba’zi buyurtmalar hali tasdiqlanmagan.");
      await audit(tx, { actorId: actor.id, action: "TRIP_STATUS", entityType: "Trip", entityId: tripId, tripId, before: { status: trip.status }, after: { status: "CLOSED" } });
      return ok({ status: "CLOSED" as TripStatus, failed: [] }, { message: "Reys yopildi." });
    });
  });
}

// ---------------------------------------------------------------------------
// Tuzatish (qabuldan keyin / yopilgan reys)
// ---------------------------------------------------------------------------
const reasonField = zRequiredText(5, 500, "Tuzatish sababini yozing (kamida 5 belgi).");
const correctionSchema = z.discriminatedUnion("target", [
  z.object({ tripId: zId, target: z.literal("WEIGHING"), weighingId: zId, grossKg: z.string().max(20), tareKg: z.string().max(20), reason: reasonField }),
  z.object({ tripId: zId, target: z.literal("ACCEPTANCE"), acceptedKg: z.string().max(20), reason: reasonField }),
  z.object({ tripId: zId, target: z.literal("EXPENSE"), expenseId: zId, amount: zSom("Xarajat summasi"), reason: reasonField }),
]);

const CORRECTABLE: readonly TripStatus[] = ["ACCEPTED", "AWAITING_PAYMENT", "CLOSED"];

export async function correctRecord(actorIn: Actor | null, raw: CorrectionInput): Promise<ActionResult> {
  return run(async () => {
    const actor = requireOperator(actorIn);
    const input = parseInput(correctionSchema, raw);
    await withTx(async (tx) => {
      if (!(await lockRow(tx, "Trip", input.tripId))) throw notFound();
      const trip = await tx.trip.findUniqueOrThrow({ where: { id: input.tripId }, select: { id: true, status: true } });
      if (!CORRECTABLE.includes(trip.status)) throw invalidTransition("Tuzatish faqat xaridor qabulidan keyin kiritiladi. Undan oldin amaldagi formadan foydalaning.");
      const obIds = await tx.obligation.findMany({ where: { tripId: trip.id }, select: { id: true }, orderBy: { id: "asc" } });
      for (const o of obIds) await lockRow(tx, "Obligation", o.id);

      if (input.target === "WEIGHING") {
        const w = await tx.weighing.findUnique({ where: { id: input.weighingId }, include: { stop: { select: { tripId: true, id: true } } } });
        if (!w || w.stop.tripId !== trip.id) throw notFound();
        const next = parseWeighing(input.grossKg, input.tareKg);
        if (next.grossGrams === w.grossGrams && next.tareGrams === w.tareGrams) throw validation("Yangi qiymat avvalgisi bilan bir xil.");
        await tx.weighing.update({ where: { id: w.id }, data: next });
        await audit(tx, {
          actorId: actor.id,
          action: "CORRECTION",
          entityType: "Weighing",
          entityId: w.id,
          tripId: trip.id,
          reason: input.reason,
          before: { grossGrams: w.grossGrams, tareGrams: w.tareGrams, netGrams: w.netGrams },
          after: next,
        });
        await refreshAcceptanceTotals(tx, trip.id, input.reason);
      } else if (input.target === "ACCEPTANCE") {
        const acc = await tx.buyerAcceptance.findUnique({ where: { tripId: trip.id } });
        if (!acc) throw notFound();
        const acceptedGrams = parseOptionalKg("acceptedKg", input.acceptedKg, "Qabul vazni");
        if (acceptedGrams === null) throw fieldError("acceptedKg", "Qabul vaznini kg’da kiriting.");
        if (acceptedGrams === acc.acceptedGrams) throw validation("Yangi qiymat avvalgisi bilan bir xil.");
        await tx.buyerAcceptance.update({ where: { id: acc.id }, data: { acceptedGrams, discrepancyGrams: acceptedGrams - acc.deliveredGrams } });
        await audit(tx, {
          actorId: actor.id,
          action: "CORRECTION",
          entityType: "BuyerAcceptance",
          entityId: acc.id,
          tripId: trip.id,
          reason: input.reason,
          before: { acceptedGrams: acc.acceptedGrams, discrepancyGrams: acc.discrepancyGrams },
          after: { acceptedGrams, discrepancyGrams: acceptedGrams - acc.deliveredGrams },
        });
        await refreshAcceptanceTotals(tx, trip.id, input.reason);
      } else {
        const e = await tx.expense.findUnique({ where: { id: input.expenseId } });
        if (!e || e.tripId !== trip.id) throw notFound();
        if (e.amount === input.amount) throw validation("Yangi qiymat avvalgisi bilan bir xil.");
        await tx.expense.update({ where: { id: e.id }, data: { amount: input.amount } });
        await audit(tx, {
          actorId: actor.id,
          action: "CORRECTION",
          entityType: "Expense",
          entityId: e.id,
          tripId: trip.id,
          reason: input.reason,
          before: { amount: e.amount },
          after: { amount: input.amount },
        });
      }

      await recomputeObligations(tx, trip.id, actor.id, input.reason);
      await tx.trip.update({ where: { id: trip.id }, data: { version: { increment: 1 } } });
      if (trip.status === "CLOSED") {
        const balances = await loadBalances(tx, trip.id);
        if (balances.some((b) => b.remaining !== 0)) {
          await moveTrip(tx, trip.id, ["CLOSED"], "AWAITING_PAYMENT", { closedAt: null });
          await audit(tx, {
            actorId: actor.id,
            action: "TRIP_STATUS",
            entityType: "Trip",
            entityId: trip.id,
            tripId: trip.id,
            reason: input.reason,
            before: { status: "CLOSED" },
            after: { status: "AWAITING_PAYMENT" },
          });
        }
      }
    });
    return okEmpty({ message: "Tuzatish saqlandi. Hisob qayta hisoblandi." });
  });
}

/** Tortish/qabul tuzatilgandan keyin qabuldagi topshirish yig'indisi va tafovutni yangilaydi. */
async function refreshAcceptanceTotals(tx: Tx, tripId: string, reason: string): Promise<void> {
  const acc = await tx.buyerAcceptance.findUnique({ where: { tripId } });
  if (!acc) return;
  const delivered = (await loadDeliveredStops(tx, tripId)).reduce((s, x) => s + x.netGrams, 0);
  const discrepancyGrams = acc.acceptedGrams - delivered;
  const data: { deliveredGrams: number; discrepancyGrams: number; discrepancyReason?: string; decision?: "OTHER"; decisionNote?: string } = {
    deliveredGrams: delivered,
    discrepancyGrams,
  };
  // Tafovut paydo bo'lsa va avval izoh/qaror bo'lmagan bo'lsa — tuzatish sababi izoh sifatida yoziladi.
  if (discrepancyGrams !== 0 && !acc.discrepancyReason) {
    data.discrepancyReason = reason;
    data.decision = "OTHER";
    data.decisionNote = `Tuzatish: ${reason}`;
  }
  if (delivered !== acc.deliveredGrams || discrepancyGrams !== acc.discrepancyGrams || data.discrepancyReason) {
    await tx.buyerAcceptance.update({ where: { id: acc.id }, data });
  }
}

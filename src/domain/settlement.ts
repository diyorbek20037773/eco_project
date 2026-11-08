// Reys hisob-kitobi — sof funksiyalar (DB'siz). Yaxlitlash faqat amountForWeight orqali.
// Model (docs/contract.md §2):
//   buyerRevenue        = amountForWeight(accepted, buyerPrice)
//   shopPayout_i        = amountForWeight(effectiveNet_i, shopPrice)   (har bekat alohida)
//   tripContribution    = buyerRevenue − Σ shopPayout − Σ expenses
//   partnerShareAfterFee = tripContribution − serviceFee
//   ecoPointServiceIncome = serviceFee   (reys iqtisodiga ikkinchi marta qo'shilmaydi)
import { amountForWeight, assertSafeInt } from "./money";
import type {
  CloseCheck,
  DisputeStatus,
  ObligationType,
  Party,
  PayState,
  PaymentKind,
  SettlementDTO,
  StopStatus,
} from "@/server/contract";

export interface SettlementStop {
  stopId: string;
  shopId: string;
  shopName: string;
  netGrams: number; // amaldagi sof vazn
}

export interface SettlementInput {
  stops: SettlementStop[];
  acceptedGrams: number;
  buyerPricePerKg: number;
  shopPricePerKg: number;
  expenses: number[];
  serviceFee: number;
}

export function sumInts(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertSafeInt(v, "summa");
    total += v;
  }
  assertSafeInt(total, "jami");
  return total;
}

export function computeSettlement(input: SettlementInput): SettlementDTO {
  const deliveredGrams = sumInts(input.stops.map((s) => s.netGrams));
  const buyerRevenue = amountForWeight(input.acceptedGrams, input.buyerPricePerKg);
  const shopPayouts = input.stops.map((s) => ({
    stopId: s.stopId,
    shopId: s.shopId,
    shopName: s.shopName,
    netGrams: s.netGrams,
    amount: amountForWeight(s.netGrams, input.shopPricePerKg),
  }));
  const shopPayoutTotal = sumInts(shopPayouts.map((p) => p.amount));
  const expensesTotal = sumInts(input.expenses);
  assertSafeInt(input.serviceFee, "xizmat haqi");
  const tripContribution = buyerRevenue - shopPayoutTotal - expensesTotal;
  return {
    deliveredGrams,
    acceptedGrams: input.acceptedGrams,
    discrepancyGrams: input.acceptedGrams - deliveredGrams,
    buyerPricePerKg: input.buyerPricePerKg,
    shopPricePerKg: input.shopPricePerKg,
    buyerRevenue,
    shopPayouts,
    shopPayoutTotal,
    expensesTotal,
    tripContribution,
    serviceFee: input.serviceFee,
    partnerShareAfterFee: tripContribution - input.serviceFee,
    ecoPointServiceIncome: input.serviceFee,
  };
}

/** Hisob uchun amaldagi sof vazn: oxirgi hal qilingan (RESOLVED) bahs qarori, aks holda tortish. */
export function effectiveNetGrams(
  stopStatus: StopStatus,
  weighingNet: number | null,
  disputes: readonly { status: DisputeStatus; decidedNetGrams: number | null; resolvedAt: Date | null }[],
): number | null {
  if (stopStatus !== "COLLECTED" || weighingNet === null) return null;
  const resolved = disputes
    .filter((d) => d.status === "RESOLVED" && d.decidedNetGrams !== null)
    .sort((a, b) => (a.resolvedAt?.getTime() ?? 0) - (b.resolvedAt?.getTime() ?? 0));
  const last = resolved[resolved.length - 1];
  return last?.decidedNetGrams ?? weighingNet;
}

// ---------------------------------------------------------------------------
// Majburiyatlar rejasi
// ---------------------------------------------------------------------------
export interface PlannedObligation {
  key: string;
  type: ObligationType;
  payer: Party;
  payee: Party;
  shopId: string | null;
  stopId: string | null;
  amount: number;
}

export const obligationKey = {
  buyer: "BUYER_MATERIAL",
  serviceFee: "SERVICE_FEE",
  shop: (stopId: string) => `SHOP_PAYOUT:${stopId}`,
} as const;

/** Hisoblangan majburiyatlar. Summasi 0 bo'lganlari rejaga kirmaydi. */
export function planObligations(s: SettlementDTO): PlannedObligation[] {
  const out: PlannedObligation[] = [
    { key: obligationKey.buyer, type: "BUYER_MATERIAL", payer: "BUYER", payee: "COLLECTOR", shopId: null, stopId: null, amount: s.buyerRevenue },
    ...s.shopPayouts.map<PlannedObligation>((p) => ({
      key: obligationKey.shop(p.stopId),
      type: "SHOP_PAYOUT",
      payer: "COLLECTOR",
      payee: "SHOP",
      shopId: p.shopId,
      stopId: p.stopId,
      amount: p.amount,
    })),
    { key: obligationKey.serviceFee, type: "SERVICE_FEE", payer: "COLLECTOR", payee: "ECO_POINT", shopId: null, stopId: null, amount: s.serviceFee },
  ];
  return out.filter((o) => o.amount > 0);
}

// ---------------------------------------------------------------------------
// To'lov holati
// ---------------------------------------------------------------------------
export function paidAmount(payments: readonly { kind: PaymentKind; amount: number }[]): number {
  let paid = 0;
  for (const p of payments) paid += p.kind === "REFUND" ? -p.amount : p.amount;
  return paid;
}

export function payState(amount: number, paid: number): PayState {
  if (paid > amount) return "OVERPAID";
  if (paid === amount) return "PAID";
  if (paid <= 0) return "UNPAID";
  return "PARTIAL";
}

export type PaymentCheck = { ok: true; remainingAfter: number } | { ok: false; reason: "OVERPAYMENT" | "NOTHING_TO_REFUND" | "NOT_POSITIVE" };

/** To'lov/qaytarishni qoldiqqa nisbatan tekshiradi. */
export function checkPayment(amount: number, paid: number, kind: PaymentKind, value: number): PaymentCheck {
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false, reason: "NOT_POSITIVE" };
  const remaining = amount - paid;
  if (kind === "PAYMENT") {
    if (value > remaining) return { ok: false, reason: "OVERPAYMENT" };
    return { ok: true, remainingAfter: remaining - value };
  }
  const overpaid = paid - amount;
  if (overpaid <= 0) return { ok: false, reason: "NOTHING_TO_REFUND" };
  if (value > overpaid) return { ok: false, reason: "OVERPAYMENT" };
  return { ok: true, remainingAfter: remaining + value };
}

// ---------------------------------------------------------------------------
// Yopish shartlari
// ---------------------------------------------------------------------------
export interface CloseCheckInput {
  stops: {
    status: StopStatus;
    confirmation: "CONFIRMED" | "DISPUTED" | null;
    disputes: readonly { status: DisputeStatus }[];
  }[];
  hasAcceptance: boolean;
  obligations: readonly { amount: number; paid: number }[];
}

export const CLOSE_CHECK_LABELS: Record<CloseCheck["key"], string> = {
  STOPS_RESOLVED: "Barcha bekatlar olingan yoki qoldirilgan",
  CONFIRMED: "Do‘konlar vaznni tasdiqlagan yoki bahs hal qilingan",
  ACCEPTANCE: "Xaridor qabuli kiritilgan",
  DISPUTES: "Ochiq bahs yo‘q",
  PAID: "Barcha majburiyatlar to‘langan",
};

/** Shart bajarilmaganda nima yetishmayotganini aytadigan matn (rad xabari uchun). */
export const CLOSE_CHECK_MISSING: Record<CloseCheck["key"], string> = {
  STOPS_RESOLVED: "hali olinmagan yoki qoldirilmagan bekat bor",
  CONFIRMED: "do‘kon tasdig‘i yoki bahs qarori kutilmoqda",
  ACCEPTANCE: "xaridor qabuli kiritilmagan",
  DISPUTES: "hal qilinmagan bahs bor",
  PAID: "to‘lanmagan majburiyat bor",
};

export function evaluateCloseChecks(input: CloseCheckInput): CloseCheck[] {
  const active = input.stops.filter((s) => s.status !== "REMOVED");
  const stopsResolved = active.length > 0 && active.every((s) => s.status === "COLLECTED" || s.status === "SKIPPED");
  const collected = active.filter((s) => s.status === "COLLECTED");
  const confirmed =
    collected.length > 0 &&
    collected.every(
      (s) =>
        s.confirmation === "CONFIRMED" ||
        (s.confirmation === "DISPUTED" &&
          s.disputes.some((d) => d.status === "RESOLVED") &&
          !s.disputes.some((d) => d.status !== "RESOLVED")),
    );
  const noOpenDisputes = !active.some((s) => s.disputes.some((d) => d.status !== "RESOLVED"));
  const paid = input.obligations.every((o) => o.amount - o.paid === 0);
  const result: [CloseCheck["key"], boolean][] = [
    ["STOPS_RESOLVED", stopsResolved],
    ["CONFIRMED", confirmed],
    ["ACCEPTANCE", input.hasAcceptance],
    ["DISPUTES", noOpenDisputes],
    ["PAID", input.hasAcceptance && paid],
  ];
  return result.map(([key, ok]) => ({ key, ok, label: CLOSE_CHECK_LABELS[key] }));
}

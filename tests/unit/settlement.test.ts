import { describe, expect, it } from "vitest";
import {
  checkPayment,
  computeSettlement,
  effectiveNetGrams,
  evaluateCloseChecks,
  paidAmount,
  payState,
  planObligations,
} from "@/domain/settlement";

const stops = [
  { stopId: "A", shopId: "s1", shopName: "Nur market", netGrams: 180_000 },
  { stopId: "B", shopId: "s2", shopName: "Bahor savdo", netGrams: 160_000 },
  { stopId: "C", shopId: "s3", shopName: "Oila supermarketi", netGrams: 160_000 },
];
const base = { stops, buyerPricePerKg: 1_500, shopPricePerKg: 800, expenses: [300_000], serviceFee: 0 };

describe("reys hisob-kitobi — majburiy misol (barcha qiymatlar shartli)", () => {
  it("500 kg qabul → hissa 50 000", () => {
    const s = computeSettlement({ ...base, acceptedGrams: 500_000 });
    expect(s.deliveredGrams).toBe(500_000);
    expect(s.discrepancyGrams).toBe(0);
    expect(s.buyerRevenue).toBe(750_000);
    expect(s.shopPayouts.map((p) => p.amount)).toEqual([144_000, 128_000, 128_000]);
    expect(s.shopPayoutTotal).toBe(400_000);
    expect(s.expensesTotal).toBe(300_000);
    expect(s.tripContribution).toBe(50_000);
  });

  it("470 kg qabul → tushum 705 000, do‘konlar 400 000, hissa 5 000, tafovut −30 kg", () => {
    const s = computeSettlement({ ...base, acceptedGrams: 470_000 });
    expect(s.buyerRevenue).toBe(705_000);
    expect(s.shopPayoutTotal).toBe(400_000);
    expect(s.tripContribution).toBe(5_000);
    expect(s.discrepancyGrams).toBe(-30_000);
    // Tafovut do'konlarga avtomatik yozilmaydi: har do'kon o'z tasdiqlangan vaznidan oladi.
    expect(s.shopPayouts.map((p) => p.netGrams)).toEqual([180_000, 160_000, 160_000]);
  });

  it("xizmat haqi 3 000: hamkorda 2 000, Eco Point daromadi 3 000; ikkinchi marta qo‘shilmaydi", () => {
    const s = computeSettlement({ ...base, acceptedGrams: 470_000, serviceFee: 3_000 });
    expect(s.tripContribution).toBe(5_000); // xizmat haqi reys hissasini o'zgartirmaydi
    expect(s.partnerShareAfterFee).toBe(2_000);
    expect(s.ecoPointServiceIncome).toBe(3_000);
    expect(s.partnerShareAfterFee + s.ecoPointServiceIncome).toBe(s.tripContribution);
  });

  it("1 000 to‘langanda xizmat haqi qoldig‘i 2 000", () => {
    const paid = paidAmount([{ kind: "PAYMENT", amount: 1_000 }]);
    expect(3_000 - paid).toBe(2_000);
    expect(payState(3_000, paid)).toBe("PARTIAL");
  });

  it("majburiyatlar rejasi: 0 summa yaratilmaydi", () => {
    const s = computeSettlement({ ...base, acceptedGrams: 470_000, serviceFee: 3_000 });
    const plan = planObligations(s);
    expect(plan.map((o) => [o.key, o.amount])).toEqual([
      ["BUYER_MATERIAL", 705_000],
      ["SHOP_PAYOUT:A", 144_000],
      ["SHOP_PAYOUT:B", 128_000],
      ["SHOP_PAYOUT:C", 128_000],
      ["SERVICE_FEE", 3_000],
    ]);
    const noFee = planObligations(computeSettlement({ ...base, acceptedGrams: 470_000 }));
    expect(noFee.some((o) => o.type === "SERVICE_FEE")).toBe(false);
    expect(plan.find((o) => o.type === "BUYER_MATERIAL")).toMatchObject({ payer: "BUYER", payee: "COLLECTOR" });
    expect(plan.find((o) => o.type === "SERVICE_FEE")).toMatchObject({ payer: "COLLECTOR", payee: "ECO_POINT" });
  });

  it("har bekat alohida yaxlitlanadi", () => {
    const s = computeSettlement({
      stops: [
        { stopId: "x", shopId: "s", shopName: "s", netGrams: 333 },
        { stopId: "y", shopId: "s", shopName: "s", netGrams: 333 },
      ],
      acceptedGrams: 666,
      buyerPricePerKg: 1_500,
      shopPricePerKg: 1_500,
      expenses: [],
      serviceFee: 0,
    });
    expect(s.shopPayouts.map((p) => p.amount)).toEqual([500, 500]);
    expect(s.shopPayoutTotal).toBe(1_000);
    expect(s.buyerRevenue).toBe(999);
    expect(s.tripContribution).toBe(-1);
  });
});

describe("amaldagi sof vazn", () => {
  it("hal qilingan bahs qarori tortishdan ustun", () => {
    expect(effectiveNetGrams("COLLECTED", 180_000, [])).toBe(180_000);
    expect(effectiveNetGrams("COLLECTED", 180_000, [{ status: "RESOLVED", decidedNetGrams: 175_000, resolvedAt: new Date() }])).toBe(175_000);
    expect(effectiveNetGrams("COLLECTED", 180_000, [{ status: "DECIDED", decidedNetGrams: 175_000, resolvedAt: null }])).toBe(180_000);
    expect(effectiveNetGrams("SKIPPED", null, [])).toBeNull();
  });
});

describe("to‘lov tekshiruvi", () => {
  it("qoldiqdan oshmaydi", () => {
    expect(checkPayment(128_000, 64_000, "PAYMENT", 64_000)).toEqual({ ok: true, remainingAfter: 0 });
    expect(checkPayment(128_000, 64_000, "PAYMENT", 64_001)).toEqual({ ok: false, reason: "OVERPAYMENT" });
    expect(checkPayment(128_000, 128_000, "PAYMENT", 1)).toEqual({ ok: false, reason: "OVERPAYMENT" });
    expect(checkPayment(128_000, 0, "PAYMENT", 0)).toEqual({ ok: false, reason: "NOT_POSITIVE" });
  });
  it("qaytarish faqat ortiqcha to‘langan bo‘lsa", () => {
    expect(checkPayment(100, 100, "REFUND", 1)).toEqual({ ok: false, reason: "NOTHING_TO_REFUND" });
    expect(checkPayment(90, 100, "REFUND", 10)).toEqual({ ok: true, remainingAfter: 0 });
    expect(checkPayment(90, 100, "REFUND", 11)).toEqual({ ok: false, reason: "OVERPAYMENT" });
  });
  it("to‘lov holati", () => {
    expect(payState(100, 0)).toBe("UNPAID");
    expect(payState(100, 50)).toBe("PARTIAL");
    expect(payState(100, 100)).toBe("PAID");
    expect(payState(90, 100)).toBe("OVERPAID");
    expect(paidAmount([{ kind: "PAYMENT", amount: 100 }, { kind: "REFUND", amount: 10 }])).toBe(90);
  });
});

describe("yopish shartlari", () => {
  const collected = { status: "COLLECTED" as const, confirmation: "CONFIRMED" as const, disputes: [] };
  it("hammasi bajarilgan", () => {
    const c = evaluateCloseChecks({ stops: [collected, { status: "SKIPPED", confirmation: null, disputes: [] }], hasAcceptance: true, obligations: [{ amount: 10, paid: 10 }] });
    expect(c.every((x) => x.ok)).toBe(true);
  });
  it("ochiq bahs, qabul yo‘q, to‘lanmagan", () => {
    const c = evaluateCloseChecks({
      stops: [{ status: "COLLECTED", confirmation: "DISPUTED", disputes: [{ status: "DECIDED" }] }],
      hasAcceptance: false,
      obligations: [{ amount: 10, paid: 5 }],
    });
    const failed = c.filter((x) => !x.ok).map((x) => x.key);
    expect(failed).toEqual(["CONFIRMED", "ACCEPTANCE", "DISPUTES", "PAID"]);
  });
  it("hal qilingan bahs tasdiq o‘rnini bosadi; PENDING bekat yopishni to‘sadi", () => {
    const c = evaluateCloseChecks({
      stops: [{ status: "COLLECTED", confirmation: "DISPUTED", disputes: [{ status: "RESOLVED" }] }, { status: "PENDING", confirmation: null, disputes: [] }],
      hasAcceptance: true,
      obligations: [],
    });
    expect(c.filter((x) => !x.ok).map((x) => x.key)).toEqual(["STOPS_RESOLVED"]);
  });
});

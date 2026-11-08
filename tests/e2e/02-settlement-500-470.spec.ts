// 2. Majburiy raqamli misol UI + DB orqali: 180 + 160 + 160 kg, 800 / 1 500 so‘m/kg, xarajat 300 000.
// 470 kg qabul: tushum 705 000, do'konlar 400 000, reys hissasi 5 000; xizmat haqi 3 000 → hamkorda 2 000;
// SERVICE_FEE ga 1 000 → qoldiq 2 000. So'ng qabul 500 kg ga tuzatiladi → hissa 50 000 + audit.
import { test, expect } from "@playwright/test";
import {
  SHOP_NAME,
  acceptanceUI,
  addExpenseUI,
  buildTripUI,
  closeAll,
  closeDb,
  confirmUI,
  createRequestUI,
  loginAs,
  obligationCard,
  obligations,
  one,
  payUI,
  q,
  stopForRequest,
  uniqueTag,
  weighUI,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

function row(scope: import("@playwright/test").Locator, label: string) {
  return scope.locator("dl > div").filter({ has: scope.page().locator("dt", { hasText: label }) });
}

test("500/470 kg misoli: tushum 705 000, do‘konlar 400 000, hissa 5 000, xizmat haqi qoldig‘i 2 000; 500 kg tuzatish → 50 000", async ({ browser }) => {
  const tag = uniqueTag("S470");
  let d1: Session | undefined, d3: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    d3 = await loginAs(browser, "dokon3");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi1");

    const rA = await createRequestUI(d1.page, { note: `A ${tag}`, point: /Nur market — Markaz/, estimatedKg: "180" });
    const rB = await createRequestUI(d1.page, { note: `B ${tag}`, point: /Nur market — Nasaf/, estimatedKg: "160" });
    const rC = await createRequestUI(d3.page, { note: `C ${tag}`, estimatedKg: "160" });

    const { tripId } = await buildTripUI(
      op.page,
      [
        { number: rA.number, shopName: SHOP_NAME.dokon1 },
        { number: rB.number, shopName: SHOP_NAME.dokon1 },
        { number: rC.number, shopName: SHOP_NAME.dokon3 },
      ],
      "Akmal",
    );
    const sA = await stopForRequest(tripId, rA.id);
    const sB = await stopForRequest(tripId, rB.id);
    const sC = await stopForRequest(tripId, rC.id);

    await weighUI(col.page, sA, "182,4", "2,4", "180 kg");
    await weighUI(col.page, sB, "161", "1", "160 kg");
    await weighUI(col.page, sC, "160,5", "0,5", "160 kg");

    await confirmUI(d1.page, rA.id);
    await confirmUI(d1.page, rB.id);
    await confirmUI(d3.page, rC.id);

    await acceptanceUI(op.page, tripId, { acceptedKg: "470", reference: `NAK-${tag}`, discrepancyReason: `Namlik va aralashma ${tag}` });
    await addExpenseUI(op.page, "300000");

    // --- UI: pul guruhi
    const money = op.page.locator("#money");
    await expect(row(money, "Xaridor to‘lovi (")).toContainText("705 000 so‘m");
    await expect(row(money, "Xaridor to‘lovi (")).toContainText("470 kg × 1 500 so‘m/kg");
    await expect(row(money, "Do‘konlarga")).toContainText("400 000 so‘m");
    await expect(row(money, "Xarajatlar")).toContainText("300 000 so‘m");
    await expect(row(money, "Butun reys hissasi")).toContainText("5 000 so‘m");
    await expect(row(money, "Eco Point xizmat haqi")).toContainText("3 000 so‘m");
    await expect(row(money, "Hamkorda qoladi")).toContainText("2 000 so‘m");
    await expect(money.getByRole("heading", { name: "Eco Point xizmat daromadi" }).locator("..")).toContainText("3 000 so‘m");
    // Vaznlar guruhi: topshirishlar va qabul yonma-yon
    const weights = op.page.locator("#weights");
    await expect(weights.getByText("500 kg").first()).toBeVisible();
    await expect(weights.getByText("470 kg").first()).toBeVisible();
    await expect(weights.getByText("−30 kg").first()).toBeVisible();

    // --- DB: majburiyatlar
    let obs = await obligations(tripId);
    const amount = (k: string) => obs.find((o) => o.key === k)?.amount;
    expect(amount("BUYER_MATERIAL")).toBe(705_000);
    expect(amount(`SHOP_PAYOUT:${sA}`)).toBe(144_000);
    expect(amount(`SHOP_PAYOUT:${sB}`)).toBe(128_000);
    expect(amount(`SHOP_PAYOUT:${sC}`)).toBe(128_000);
    expect(obs.filter((o) => o.type === "SHOP_PAYOUT").reduce((s, o) => s + o.amount, 0)).toBe(400_000);
    expect(amount("SERVICE_FEE")).toBe(3_000);
    const exp = await one<{ total: number }>(`SELECT COALESCE(sum(amount),0)::int AS total FROM "Expense" WHERE "tripId" = $1`, [tripId]);
    expect(exp.total).toBe(300_000);
    // Hissa = 705 000 − 400 000 − 300 000 = 5 000; xizmat haqi reys daromadiga qo'shilmaydi.
    expect(705_000 - 400_000 - exp.total).toBe(5_000);

    // --- Xizmat haqi: 1 000 to'lov → qoldiq 2 000
    const fee = obligationCard(op.page, "Eco Point xizmat haqi");
    await payUI(fee, "1000");
    await expect(fee.getByText("To‘lov qayd etildi. Qoldiq: 2 000 so‘m.")).toBeVisible();
    await expect(row(fee, "Qoldiq")).toContainText("2 000 so‘m");
    obs = await obligations(tripId);
    const feeOb = obs.find((o) => o.key === "SERVICE_FEE")!;
    expect(feeOb.amount - feeOb.paid).toBe(2_000);

    // --- Tuzatish: qabul 500 kg → tushum 750 000, hissa 50 000, hamkorda 47 000; audit (eski/yangi/sabab/muallif/vaqt)
    const correct = op.page.locator("#correct");
    await correct.getByRole("combobox", { name: "Nimani tuzatamiz?" }).selectOption("A");
    await correct.getByRole("textbox", { name: /^Yangi qabul vazni/ }).fill("500");
    await correct.getByRole("textbox", { name: /^Tuzatish sababi/ }).fill(`Xaridor qayta tortdi ${tag}`);
    await correct.getByRole("button", { name: "Tuzatishni saqlash" }).click();
    await expect(correct.getByText(/Tuzatish saqlandi/)).toBeVisible();
    await expect(row(money, "Xaridor to‘lovi (")).toContainText("750 000 so‘m");
    await expect(row(money, "Butun reys hissasi")).toContainText("50 000 so‘m");
    await expect(row(money, "Hamkorda qoladi")).toContainText("47 000 so‘m");
    obs = await obligations(tripId);
    expect(obs.find((o) => o.key === "BUYER_MATERIAL")?.amount).toBe(750_000);
    expect(obs.filter((o) => o.type === "SHOP_PAYOUT").reduce((s, o) => s + o.amount, 0)).toBe(400_000);
    const audit = await q<{ action: string; reason: string | null; before: unknown; after: unknown; actorId: string | null; at: Date }>(
      `SELECT action, reason, before, after, "actorId", at FROM "AuditEvent" WHERE "tripId" = $1 AND reason = $2`,
      [tripId, `Xaridor qayta tortdi ${tag}`],
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const ev = audit[0]!;
    expect(JSON.stringify(ev.before)).toContain("470000");
    expect(JSON.stringify(ev.after)).toContain("500000");
    const actor = await one<{ login: string }>(`SELECT login FROM "User" WHERE id = $1`, [ev.actorId]);
    expect(actor.login).toBe("operator");
    expect(ev.at).toBeInstanceOf(Date);
    await expect(op.page.locator("#audit")).toContainText(`Xaridor qayta tortdi ${tag}`);
  } finally {
    await closeAll(d1, d3, op, col);
  }
});

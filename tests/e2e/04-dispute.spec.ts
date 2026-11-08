// 4. Bahs: do'kon e'tiroz (sabab, kg) → bahs ochiqligida yopish rad → operator qarori →
// do'kon va yig'uvchi rozi → «Hal qilindi» → yopishga ruxsat (to'lov qolgani uchun «To‘lov kutilmoqda»).
import { test, expect } from "@playwright/test";
import {
  SHOP_NAME,
  acceptanceUI,
  buildTripUI,
  clickClose,
  closeAll,
  closeDb,
  createRequestUI,
  loginAs,
  one,
  stopForRequest,
  tripStatus,
  uniqueTag,
  weighUI,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

test("bahs: e’tiroz → ochiq bahsda yopish rad → qaror → ikki tomon roziligi → hal qilindi → yopish", async ({ browser }) => {
  const tag = uniqueTag("DSP");
  let d2: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d2 = await loginAs(browser, "dokon2");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi1");

    const r = await createRequestUI(d2.page, { note: `Bahs ${tag}`, estimatedKg: "110" });
    const { tripId, tripNumber } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon2 }], "Akmal");
    const stopId = await stopForRequest(tripId, r.id);
    await weighUI(col.page, stopId, "101", "1", "100 kg");

    // Do'kon e'tiroz bildiradi
    await d2.page.goto(`/shop/requests/${r.id}`);
    await d2.page.getByRole("button", { name: "E’tiroz bildirish" }).click();
    await d2.page.getByRole("textbox", { name: /^E’tiroz sababi/ }).fill(`Bizda 110 kg chiqdi ${tag}`);
    await d2.page.getByRole("textbox", { name: /^Sizningcha sof vazn/ }).fill("110");
    await d2.page.getByRole("button", { name: "E’tirozni yuborish" }).click();
    await expect(d2.page.getByText("Bahsli").first()).toBeVisible();
    const d = await one<{ id: string; status: string; claimedNetGrams: number; reason: string }>(
      `SELECT id, status::text AS status, "claimedNetGrams", reason FROM "Dispute" WHERE "stopId" = $1`,
      [stopId],
    );
    expect(d).toMatchObject({ status: "OPEN", claimedNetGrams: 110_000, reason: `Bizda 110 kg chiqdi ${tag}` });

    // Operator: bahs belgisi; qabul (tafovutsiz) → yopish urinishi rad etiladi
    await op.page.goto(`/operator/trips/${tripId}`);
    await expect(op.page.getByText("Bahs: 1 ta hal qilinmagan")).toBeVisible();
    await acceptanceUI(op.page, tripId, { acceptedKg: "100", reference: `NAK-${tag}` });
    await clickClose(op.page);
    const closeErr = op.page.getByText(/^Reysni yopib bo‘lmaydi: .*bahs/i);
    await expect(closeErr).toBeVisible();
    expect(await tripStatus(tripId)).toBe("ACCEPTED");

    // Operator qarori (matn + yakuniy kg)
    await op.page.reload();
    const decide = op.page.locator("details", { hasText: "Bahs bo‘yicha qaror chiqarish" });
    await decide.getByRole("textbox", { name: /^Qaror/ }).fill(`Tarozi rasmi bo‘yicha 105 kg ${tag}`);
    await decide.getByRole("textbox", { name: /^Yakuniy sof vazn/ }).fill("105");
    await decide.getByRole("button", { name: "Qarorni saqlash" }).click();
    await expect.poll(async () => (await one<{ status: string }>(`SELECT status::text AS status FROM "Dispute" WHERE id = $1`, [d.id])).status).toBe("DECIDED");

    // Qaror chiqdi, lekin tomonlar rozi emas — yopish hali rad
    await op.page.reload();
    await clickClose(op.page);
    await expect(op.page.getByText(/^Reysni yopib bo‘lmaydi: .*bahs/i)).toBeVisible();

    // Do'kon rozi
    await d2.page.goto(`/shop/requests/${r.id}`);
    const shopAck = d2.page.locator("article").filter({ has: d2.page.getByRole("button", { name: "Roziman" }) });
    await expect(shopAck).toContainText("105 kg");
    await shopAck.getByRole("button", { name: "Roziman" }).click();
    await expect(d2.page.getByText("Roziligingiz qayd etildi")).toBeVisible();

    // Yig'uvchi rozi («Bugungi reys» sahifasida)
    await col.page.goto("/collector");
    const colAck = col.page.locator("article", { hasText: `Reys №${tripNumber}` }).filter({ has: col.page.getByRole("button", { name: "Roziman" }) });
    await expect(colAck).toContainText("105 kg");
    await colAck.getByRole("button", { name: "Roziman" }).click();
    await expect(col.page.getByText(/Bahs yopildi/)).toBeVisible();

    const resolved = await one<{ status: string; decidedNetGrams: number; openKey: string | null }>(
      `SELECT status::text AS status, "decidedNetGrams", "openKey" FROM "Dispute" WHERE id = $1`,
      [d.id],
    );
    expect(resolved).toEqual({ status: "RESOLVED", decidedNetGrams: 105_000, openKey: null });
    const shopOb = await one<{ amount: number }>(`SELECT amount FROM "Obligation" WHERE "tripId" = $1 AND key = $2`, [tripId, `SHOP_PAYOUT:${stopId}`]);
    expect(shopOb.amount).toBe(84_000); // 105 kg × 800 — yakuniy vazn bo'yicha qayta hisoblandi

    // Operator: «Bahs hal qilindi» → yopish endi bloklanmaydi (to'lov qolgani uchun «To‘lov kutilmoqda»)
    await op.page.reload();
    await expect(op.page.getByText("Bahs hal qilindi").first()).toBeVisible();
    await expect(op.page.getByText("Bahs: 1 ta hal qilinmagan")).toHaveCount(0);
    await clickClose(op.page);
    await expect(op.page.getByText("To‘lov kutilmoqda").first()).toBeVisible();
    await expect.poll(() => tripStatus(tripId)).toBe("AWAITING_PAYMENT");
  } finally {
    await closeAll(d2, op, col);
  }
});

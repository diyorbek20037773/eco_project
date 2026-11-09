// 15. Bahs qaroriga norozilik: do'kon e'tiroz → operator qarori → yig'uvchi rozi, do'kon «Rozi emasman»
// (izoh) → bahs qayta OPEN (lastRejectComment, ikkala rozilik bekor) → operator sahifasida izoh →
// operator qayta qaror → ikki tomon rozi → RESOLVED, majburiyat emas, buyurtma CONFIRMED.
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  SCREENS_DIR,
  SHOP_NAME,
  buildTripUI,
  callAction,
  closeAll,
  closeDb,
  createRequestUI,
  loginAs,
  one,
  q,
  stopForRequest,
  uniqueTag,
  weighUI,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

interface DisputeRow extends Record<string, unknown> {
  id: string;
  status: string;
  decidedNetGrams: number | null;
  decisionText: string | null;
  lastRejectComment: string | null;
  shopAckAt: Date | null;
  collectorAckAt: Date | null;
  openKey: string | null;
}

async function dispute(stopId: string): Promise<DisputeRow> {
  return one<DisputeRow>(
    `SELECT id, status::text AS status, "decidedNetGrams", "decisionText", "lastRejectComment", "shopAckAt", "collectorAckAt", "openKey"
       FROM "Dispute" WHERE "stopId" = $1`,
    [stopId],
  );
}

test("bahs: qarorga «Rozi emasman» → bahs qayta ochiladi → qayta qaror → ikki tomon roziligi → hal qilindi", async ({ browser }) => {
  const tag = uniqueTag("REJ");
  let d1: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi1");

    const r = await createRequestUI(d1.page, { note: `Norozilik ${tag}`, point: /Nur market — Markaz/, estimatedKg: "110" });
    const { tripId, tripNumber } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon1 }], "Akmal");
    const stopId = await stopForRequest(tripId, r.id);
    await weighUI(col.page, stopId, "101", "1", "100 kg");

    // 1) Do'kon e'tirozi
    await d1.page.goto(`/shop/requests/${r.id}`);
    await d1.page.getByRole("button", { name: "E’tiroz bildirish" }).click();
    await d1.page.getByRole("textbox", { name: /^E’tiroz sababi/ }).fill(`Bizda 110 kg ${tag}`);
    await d1.page.getByRole("textbox", { name: /^Sizningcha sof vazn/ }).fill("110");
    await d1.page.getByRole("button", { name: "E’tirozni yuborish" }).click();
    await expect(d1.page.getByText("Bahsli").first()).toBeVisible();
    expect((await dispute(stopId)).status).toBe("OPEN");

    // 2) Operator qarori: 105 kg
    await op.page.goto(`/operator/trips/${tripId}`);
    let decide = op.page.locator("details", { hasText: "Bahs bo‘yicha qaror chiqarish" });
    await decide.getByRole("textbox", { name: /^Qaror/ }).fill(`Birinchi qaror: 105 kg ${tag}`);
    await decide.getByRole("textbox", { name: /^Yakuniy sof vazn/ }).fill("105");
    await decide.getByRole("button", { name: "Qarorni saqlash" }).click();
    await expect.poll(async () => (await dispute(stopId)).status).toBe("DECIDED");
    const d = await dispute(stopId);
    expect(d).toMatchObject({ decidedNetGrams: 105_000, shopAckAt: null, collectorAckAt: null });

    // 3) Yig'uvchi birinchi bo'lib rozi bo'ladi
    await col.page.goto("/collector");
    const colAck1 = col.page.locator("article", { hasText: `Reys №${tripNumber}` }).filter({ has: col.page.getByRole("button", { name: "Roziman" }) });
    await expect(colAck1).toContainText("105 kg");
    await colAck1.getByRole("button", { name: "Roziman" }).click();
    await expect(col.page.getByText("Roziligingiz qayd etildi").first()).toBeVisible();
    await expect.poll(async () => (await dispute(stopId)).collectorAckAt).not.toBeNull();

    // 4) Do'kon rozi emas — izoh majburiy
    const comment = `Tarozi rasmi xira, 110 kg turibdi ${tag}`;
    await d1.page.goto(`/shop/requests/${r.id}`);
    // DisputeAck kartasi (kvitansiya kartasida ham «Bahs: qaror chiqdi…» belgisi bor — shuning uchun maydonlar bo'yicha).
    const shopAck = d1.page.locator("article", { hasText: "Operator qarori" }).filter({ hasText: "E’tiroz sababi" });
    await expect(shopAck).toHaveCount(1);
    await expect(shopAck).toContainText(`Birinchi qaror: 105 kg ${tag}`);
    await shopAck.getByRole("button", { name: "Rozi emasman" }).click();
    const commentBox = shopAck.getByRole("textbox", { name: /^Nima uchun rozi emassiz/ });
    // (a) Bo'sh izoh — yuborilmaydi, forma o'zbekcha xato ko'rsatadi
    await shopAck.getByRole("button", { name: "Javobni yuborish" }).click();
    const native = await commentBox.evaluate((el: HTMLTextAreaElement) => ({ missing: el.validity.valueMissing, message: el.validationMessage }));
    await expect(shopAck.getByText("Nima uchun rozi emasligingizni yozing.")).toBeVisible(); // noValidate: brauzerning inglizcha xabari emas
    const uzShown = true;
    test.info().annotations.push({ type: "bo‘sh izoh", description: `valueMissing=${native.missing}; brauzer xabari="${native.message}"; o‘zbekcha xabar ko‘rindi=${uzShown}` });
    expect(native.missing || uzShown, "bo‘sh izoh bilan yuborish to‘xtatilishi kerak").toBe(true);
    expect((await dispute(stopId)).status).toBe("DECIDED");
    // (b) Faqat bo'shliq — o'zbekcha xato, DB o'zgarmaydi
    await commentBox.fill("   ");
    await shopAck.getByRole("button", { name: "Javobni yuborish" }).click();
    await expect(shopAck.getByText("Nima uchun rozi emasligingizni yozing.")).toBeVisible();
    await expect(shopAck.getByText("Izoh majburiy.")).toBeVisible();
    expect((await dispute(stopId)).status).toBe("DECIDED");
    // (c) Server ham izohsiz norozilikni rad etadi
    const noComment = await callAction(d1.page, "acknowledgeDispute", { disputeId: d.id, agree: false });
    expect(noComment.result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((await dispute(stopId)).status).toBe("DECIDED");
    await commentBox.fill(comment);
    await shopAck.getByRole("button", { name: "Javobni yuborish" }).click();
    await expect(d1.page.getByText(/Rozi emasligingiz yuborildi|Javobingiz yuborildi/).first()).toBeVisible();

    const reopened = await dispute(stopId);
    expect(reopened).toMatchObject({ id: d.id, status: "OPEN", lastRejectComment: comment, shopAckAt: null, collectorAckAt: null, openKey: stopId });
    expect((await one<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = $1`, [r.id])).status).toBe("DISPUTED");
    const rejAudit = await q<{ reason: string }>(`SELECT reason FROM "AuditEvent" WHERE action = 'DISPUTE_REJECTED' AND "entityId" = $1`, [d.id]);
    expect(rejAudit).toEqual([{ reason: comment }]);

    // Do'kon sahifasida: bahs ochiq, oxirgi e'tiroz izohi ko'rinadi, «Roziman» yo'q
    await d1.page.reload();
    await expect(d1.page.getByText(comment)).toBeVisible();
    await expect(d1.page.getByRole("button", { name: "Roziman" })).toHaveCount(0);

    // 5) Operator: bahs qayta ochiq, izoh ko'rinadi, qaror formasi yana bor
    await op.page.goto(`/operator/trips/${tripId}`);
    await expect(op.page.getByText("Bahs: 1 ta hal qilinmagan")).toBeVisible();
    await expect(op.page.locator("#stops").getByText("Oxirgi e’tiroz izohi")).toBeVisible();
    await expect(op.page.locator("#stops").getByText(comment)).toBeVisible();
    await op.page.screenshot({ path: path.join(SCREENS_DIR, "dispute-reopened-operator-1440.png"), fullPage: true });
    decide = op.page.locator("details", { hasText: "Bahs bo‘yicha qaror chiqarish" });
    await expect(decide.getByRole("button", { name: "Qarorni saqlash" })).toBeVisible();
    await decide.getByRole("textbox", { name: /^Qaror/ }).fill(`Ikkinchi qaror: 108 kg ${tag}`);
    await decide.getByRole("textbox", { name: /^Yakuniy sof vazn/ }).fill("108");
    await decide.getByRole("button", { name: "Qarorni saqlash" }).click();
    await expect.poll(async () => (await dispute(stopId)).status).toBe("DECIDED");
    expect(await dispute(stopId)).toMatchObject({ decidedNetGrams: 108_000, decisionText: `Ikkinchi qaror: 108 kg ${tag}`, shopAckAt: null, collectorAckAt: null });

    // 6) Ikki tomon rozi — avval do'kon, keyin yig'uvchi (yig'uvchining avvalgi roziligi bekor bo'lgani uchun qayta so'raladi)
    await d1.page.goto(`/shop/requests/${r.id}`);
    const shopAck2 = d1.page.locator("article").filter({ has: d1.page.getByRole("button", { name: "Roziman" }) });
    await expect(shopAck2).toContainText("108 kg");
    await shopAck2.getByRole("button", { name: "Roziman" }).click();
    await expect(d1.page.getByText("Roziligingiz qayd etildi").first()).toBeVisible();
    expect((await dispute(stopId)).status).toBe("DECIDED");

    await col.page.goto("/collector");
    const colAck2 = col.page.locator("article", { hasText: `Reys №${tripNumber}` }).filter({ has: col.page.getByRole("button", { name: "Roziman" }) });
    await expect(colAck2).toContainText("108 kg");
    await colAck2.getByRole("button", { name: "Roziman" }).click();
    await expect(col.page.getByText(/Bahs yopildi/).first()).toBeVisible();

    const resolved = await dispute(stopId);
    expect(resolved).toMatchObject({ status: "RESOLVED", decidedNetGrams: 108_000, openKey: null });
    expect(resolved.shopAckAt).not.toBeNull();
    expect(resolved.collectorAckAt).not.toBeNull();
    expect((await one<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = $1`, [r.id])).status).toBe("CONFIRMED");
    // Bir tranzaksiyadagi hodisalar bir xil vaqtga ega bo'lishi mumkin — RESOLVED tenglikda oxirida.
    const trail = await q<{ action: string }>(
      `SELECT action FROM "AuditEvent" WHERE "entityId" = $1 AND "entityType" = 'Dispute'
        ORDER BY at, CASE action WHEN 'DISPUTE_RESOLVED' THEN 1 ELSE 0 END`,
      [d.id],
    );
    expect(trail.map((t) => t.action)).toEqual([
      "WEIGHT_DISPUTED",
      "DISPUTE_DECIDED",
      "DISPUTE_ACKNOWLEDGED",
      "DISPUTE_REJECTED",
      "DISPUTE_DECIDED",
      "DISPUTE_ACKNOWLEDGED",
      "DISPUTE_ACKNOWLEDGED",
      "DISPUTE_RESOLVED",
    ]);

    await op.page.reload();
    await expect(op.page.getByText("Bahs: 1 ta hal qilinmagan")).toHaveCount(0);
    await expect(op.page.getByText("Bahs hal qilindi").first()).toBeVisible();
  } finally {
    await closeAll(d1, op, col);
  }
});

// 5. Yo'l qo'yilmagan holat o'tishlari server tomonidan rad etiladi (o'zbekcha xabar bilan):
// qabulsiz yopish, PLANNED reysda qabul, qoldirilgan bekatni tortish (eskirgan UI orqali), ortiqcha tara.
import { test, expect } from "@playwright/test";
import {
  SHOP_NAME,
  buildTripUI,
  callAction,
  closeAll,
  closeDb,
  createRequestUI,
  fillWeighing,
  loginAs,
  nowTimeTashkent,
  one,
  q,
  stopForRequest,
  todayTashkent,
  tripStatus,
  uniqueTag,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

test("yo‘l qo‘yilmagan o‘tishlar: qabulsiz yopish, PLANNED reysda qabul, qoldirilgan bekatni tortish, tara > brutto", async ({ browser }) => {
  const tag = uniqueTag("BAD");
  let d1: Session | undefined, d3: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    d3 = await loginAs(browser, "dokon3");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi2");

    const rA = await createRequestUI(d1.page, { note: `A ${tag}`, point: /Nur market — Nasaf/ });
    const rB = await createRequestUI(d3.page, { note: `B ${tag}` });
    const { tripId } = await buildTripUI(
      op.page,
      [
        { number: rA.number, shopName: SHOP_NAME.dokon1 },
        { number: rB.number, shopName: SHOP_NAME.dokon3 },
      ],
      "Bekzod",
    );
    expect(await tripStatus(tripId)).toBe("PLANNED");
    // UI bu holatda yopish va qabul formalarini ko'rsatmaydi:
    await expect(op.page.getByRole("button", { name: "Reysni yopish" })).toHaveCount(0);
    await expect(op.page.getByRole("button", { name: "Qabulni saqlash" })).toHaveCount(0);

    // (a) Qabulsiz yopish — to'g'ridan-to'g'ri server action
    const close = await callAction(op.page, "closeTrip", { tripId });
    expect(close.result, close.raw.slice(0, 400)).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(close.result?.error).toMatch(/^Reysni yopib bo‘lmaydi/);
    expect(await tripStatus(tripId)).toBe("PLANNED");

    // (b) PLANNED reysda xaridor qabuli
    const acc = await callAction(op.page, "recordAcceptance", {
      tripId,
      clientKey: crypto.randomUUID(),
      acceptedKg: "100",
      quality: "GOOD",
      buyerPricePerKg: 1500,
      buyerReference: `NAK-${tag}`,
      acceptedDate: todayTashkent(),
      acceptedTime: nowTimeTashkent(5),
    });
    expect(acc.result, acc.raw.slice(0, 400)).toMatchObject({ ok: false, code: "INVALID_TRANSITION", error: "Barcha bekatlar olinmaguncha xaridor qabulini kiritib bo‘lmaydi." });
    expect((await q(`SELECT 1 FROM "BuyerAcceptance" WHERE "tripId" = $1`, [tripId])).length).toBe(0);

    // (c) Ortiqcha tara: UI xatosi + tugma faol emas; server ham rad etadi
    const stopA = await stopForRequest(tripId, rA.id);
    const stopB = await stopForRequest(tripId, rB.id);
    await col.page.goto(`/collector/stops/${stopA}`);
    await fillWeighing(col.page, "50", "60");
    await expect(col.page.getByText("Tara bruttodan katta bo‘lishi mumkin emas.")).toBeVisible();
    await expect(col.page.getByRole("button", { name: "Tortishni saqlash" })).toBeDisabled();
    const neg = await callAction(col.page, "recordWeighing", { stopId: stopA, clientKey: crypto.randomUUID(), grossKg: "50", tareKg: "60" });
    expect(neg.result, neg.raw.slice(0, 400)).toMatchObject({ ok: false });
    expect(neg.result?.error).toMatch(/Tara bruttodan katta/);
    expect((await q(`SELECT 1 FROM "Weighing" WHERE "stopId" = $1`, [stopA])).length).toBe(0);

    // (d) Qoldirilgan bekatni tortish: birinchi tab tortish formasini ochib turadi,
    // ikkinchi tabda bekat qoldiriladi, so'ng eskirgan formadan yuboriladi → server rad etadi.
    await fillWeighing(col.page, "52", "2");
    await expect(col.page.locator("output")).toHaveText("50 kg");
    const tab2 = await col.context.newPage();
    await tab2.goto(`/collector/stops/${stopA}`);
    await tab2.getByRole("button", { name: "Karton tayyor emas" }).click();
    await tab2.getByRole("button", { name: "Qoldirishni tasdiqlash" }).click();
    await expect(tab2.getByText("Nuqta qoldirildi")).toBeVisible();
    await tab2.close();
    await col.page.getByRole("button", { name: "Tortishni saqlash" }).click();
    await expect(col.page.getByText("Saqlanmadi")).toBeVisible();
    await expect(col.page.getByText("Bu bekat qoldirilgan. Tortib bo‘lmaydi.")).toBeVisible();
    expect((await q(`SELECT 1 FROM "Weighing" WHERE "stopId" = $1`, [stopA])).length).toBe(0);
    expect((await one<{ status: string }>(`SELECT status::text AS status FROM "TripStop" WHERE id = $1`, [stopA])).status).toBe("SKIPPED");

    // (e) Reys hali yig'ilmagan (B kutilmoqda) — qabul yana rad, yopish yana rad
    expect(await tripStatus(tripId)).toBe("IN_PROGRESS");
    const acc2 = await callAction(op.page, "recordAcceptance", {
      tripId,
      clientKey: crypto.randomUUID(),
      acceptedKg: "100",
      quality: "GOOD",
      buyerPricePerKg: 1500,
      buyerReference: `NAK-${tag}`,
      acceptedDate: todayTashkent(),
      acceptedTime: nowTimeTashkent(5),
    });
    expect(acc2.result).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    // Qoldirilgan bekatni qayta qoldirish — idempotent takror (replayed), holat va sabab o'zgarmaydi
    const reskip = await callAction(col.page, "skipStop", { stopId: stopA, reason: "Do‘kon yopiq" });
    expect(reskip.result).toMatchObject({ ok: true, replayed: true });
    const skipped = await one<{ skipReason: string; n: number }>(
      `SELECT s."skipReason", (SELECT count(*)::int FROM "AuditEvent" a WHERE a."entityId" = s.id AND a.action = 'STOP_SKIPPED') AS n FROM "TripStop" s WHERE s.id = $1`,
      [stopA],
    );
    expect(skipped).toEqual({ skipReason: "Karton tayyor emas", n: 1 });
    // Olingan bekatni qoldirib bo'lmaydi
    await col.page.goto(`/collector/stops/${stopB}`);
    await fillWeighing(col.page, "21", "1");
    await col.page.getByRole("button", { name: "Tortishni saqlash" }).click();
    await expect(col.page.getByText("Saqlandi: 20 kg")).toBeVisible();
    const skipCollected = await callAction(col.page, "skipStop", { stopId: stopB, reason: "Karton tayyor emas" });
    expect(skipCollected.result).toMatchObject({ ok: false, code: "INVALID_TRANSITION", error: "Bu bekatni qoldirib bo‘lmaydi: u allaqachon olingan." });
    // Tortilgan bekatni qayta tortish (yangi clientKey) — rad
    const reweigh = await callAction(col.page, "recordWeighing", { stopId: stopB, clientKey: crypto.randomUUID(), grossKg: "30", tareKg: "0" });
    expect(reweigh.result).toMatchObject({ ok: false, code: "INVALID_TRANSITION", error: "Bu bekat allaqachon tortilgan." });
    expect((await q(`SELECT 1 FROM "Weighing" WHERE "stopId" = $1`, [stopB])).length).toBe(1);
  } finally {
    await closeAll(d1, d3, op, col);
  }
});

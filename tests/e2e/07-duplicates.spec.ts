// 7. Takroriy topshirish va to'lov: tugmani tez ikki marta bosish → DB'da bitta yozuv;
// bir clientKey bilan takror → replayed; ortiqcha/takroriy to'lov → rad; parallel ikki operator
// bir buyurtmani ikki reysga qo'sha olmaydi.
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  DESKTOP,
  SCREENS_DIR,
  SHOP_NAME,
  acceptanceUI,
  buildTripUI,
  callAction,
  closeAll,
  closeDb,
  confirmUI,
  fillTripBuilder,
  fillWeighing,
  loginAs,
  obligationCard,
  one,
  q,
  stopForRequest,
  todayTashkent,
  uniqueTag,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

test("takroriy bosish va clientKey: buyurtma, tortish, to‘lov — bitta yozuv; ortiqcha to‘lov rad", async ({ browser }) => {
  const tag = uniqueTag("DUP");
  let d1: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi1");

    // --- «Yuborish» ni tez ikki marta bosish
    await d1.page.goto("/shop/new");
    await d1.page.getByRole("radio", { name: /Nur market — Markaz/ }).check();
    await d1.page.getByRole("textbox", { name: /^Izoh/ }).fill(`Dbl ${tag}`);
    await d1.page.getByRole("button", { name: "Yuborish" }).dblclick();
    await d1.page.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
    const reqs = await q<{ id: string; number: number }>(`SELECT id, number FROM "PickupRequest" WHERE note = $1`, [`Dbl ${tag}`]);
    expect(reqs).toHaveLength(1);
    const r = reqs[0]!;

    // Bir clientKey bilan ikki marta (sahifa yangilanishi / qayta yuborish) → bitta yozuv
    const key = crypto.randomUUID();
    const args = { clientKey: key, pointId: "seed-point-nur-nasaf", readyDate: todayTashkent(), fromTime: "09:00", toTime: "12:00", volume: "SMALL", note: `Key ${tag}` };
    await d1.page.goto("/shop/new");
    const first = await callAction(d1.page, "createPickupRequest", args);
    const second = await callAction(d1.page, "createPickupRequest", args);
    expect(first.result).toMatchObject({ ok: true });
    expect(second.result).toMatchObject({ ok: true, replayed: true });
    expect(second.result?.data?.requestId).toBe(first.result?.data?.requestId);
    expect((await q(`SELECT 1 FROM "PickupRequest" WHERE "clientKey" = $1`, [key])).length).toBe(1);

    // --- Tortish: tez ikki marta bosish
    const { tripId } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon1 }], "Akmal");
    const stopId = await stopForRequest(tripId, r.id);
    await col.page.goto(`/collector/stops/${stopId}`);
    await fillWeighing(col.page, "40", "0");
    await col.page.getByRole("button", { name: "Tortishni saqlash" }).dblclick();
    await expect(col.page.getByText("Saqlandi: 40 kg")).toBeVisible();
    expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM "Weighing" WHERE "stopId" = $1`, [stopId])).n).toBe(1);
    // Sahifani yangilab qayta yuborish (xuddi shu clientKey) → replayed
    const w = await one<{ clientKey: string }>(`SELECT "clientKey" FROM "Weighing" WHERE "stopId" = $1`, [stopId]);
    const replay = await callAction(col.page, "recordWeighing", { stopId, clientKey: w.clientKey, grossKg: "40", tareKg: "0" });
    expect(replay.result).toMatchObject({ ok: true, replayed: true });
    expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM "Weighing" WHERE "stopId" = $1`, [stopId])).n).toBe(1);

    await confirmUI(d1.page, r.id);
    await acceptanceUI(op.page, tripId, { acceptedKg: "40", reference: `NAK-${tag}` });

    // --- To'lov: tez ikki marta bosish (xaridor 60 000 → 30 000 qisman)
    const buyer = obligationCard(op.page, "Material uchun to‘lov");
    const box = buyer.locator("details");
    await box.locator("summary").click();
    await box.getByRole("textbox", { name: /^To‘langan summa/ }).fill("30000");
    await box.locator('button[type="submit"]').dblclick();
    await expect(box.getByText("To‘lov qayd etildi. Qoldiq: 30 000 so‘m.")).toBeVisible();
    const ob = await one<{ id: string; amount: number }>(`SELECT id, amount FROM "Obligation" WHERE "tripId" = $1 AND key = 'BUYER_MATERIAL'`, [tripId]);
    expect(ob.amount).toBe(60_000);
    let pays = await q<{ amount: number; clientKey: string }>(`SELECT amount, "clientKey" FROM "Payment" WHERE "obligationId" = $1`, [ob.id]);
    expect(pays).toHaveLength(1);
    expect(pays[0]!.amount).toBe(30_000);

    // Muvaffaqiyatdan keyin forma yangi qoldiq bilan ishlashi kerak (eskirgan summa xato ko'rsatmasin)
    const amountField = box.getByRole("textbox", { name: /^To‘langan summa/ });
    await expect.soft(amountField, "To‘lovdan keyin summa maydoni yangi qoldiqni ko‘rsatsin").toHaveValue("30 000");
    await expect.soft(box.getByText(/^Ko‘pi bilan /), "To‘lovdan keyin darhol «Ko‘pi bilan …» xatosi chiqmasin").toHaveCount(0);
    await buyer.screenshot({ path: path.join(SCREENS_DIR, "defect-payment-after-partial-1440.png") });

    // Ortiqcha to'lov — mijozda rad
    await amountField.fill("30001");
    await box.locator('button[type="submit"]').click();
    await expect(box.getByText(/Ortiqcha to‘lov qabul qilinmaydi/)).toBeVisible();
    // Ortiqcha to'lov — serverda rad (UI chetlab o'tilsa)
    const over = await callAction(op.page, "recordPayment", { obligationId: ob.id, clientKey: crypto.randomUUID(), amount: 30_001, paidDate: todayTashkent() });
    expect(over.result).toMatchObject({ ok: false, code: "OVERPAYMENT", error: expect.stringMatching(/^Summa qoldiqdan oshib ketdi\. Ko‘pi bilan 30\s000\sso‘m kiritish mumkin\.$/) });
    // Takroriy clientKey → replayed, yangi yozuv yo'q
    const again = await callAction(op.page, "recordPayment", { obligationId: ob.id, clientKey: pays[0]!.clientKey, amount: 30_000, paidDate: todayTashkent() });
    expect(again.result).toMatchObject({ ok: true, replayed: true });
    // To'liq to'lov, so'ng takroriy to'lov (yangi kalit) → rad
    const full = await callAction(op.page, "recordPayment", { obligationId: ob.id, clientKey: crypto.randomUUID(), amount: 30_000, paidDate: todayTashkent() });
    expect(full.result).toMatchObject({ ok: true });
    const dup = await callAction(op.page, "recordPayment", { obligationId: ob.id, clientKey: crypto.randomUUID(), amount: 30_000, paidDate: todayTashkent() });
    expect(dup.result).toMatchObject({ ok: false, code: "OVERPAYMENT", error: "Bu majburiyat to‘liq to‘langan. Takroriy to‘lov kiritilmadi." });
    pays = await q(`SELECT amount, "clientKey" FROM "Payment" WHERE "obligationId" = $1`, [ob.id]);
    expect(pays.reduce((s, p) => s + p.amount, 0)).toBe(60_000);
    expect(pays).toHaveLength(2);
  } finally {
    await closeAll(d1, op, col);
  }
});

test("parallel ikki operator bir buyurtmani ikki reysga qo‘sha olmaydi", async ({ browser }) => {
  const tag = uniqueTag("PAR");
  let d3: Session | undefined, opA: Session | undefined, opB: Session | undefined;
  try {
    d3 = await loginAs(browser, "dokon3");
    opA = await loginAs(browser, "operator", DESKTOP);
    opB = await loginAs(browser, "operator", DESKTOP);
    await d3.page.goto("/shop/new");
    await d3.page.getByRole("textbox", { name: /^Izoh/ }).fill(`Par ${tag}`);
    await d3.page.getByRole("button", { name: "Yuborish" }).click();
    await d3.page.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
    const r = await one<{ id: string; number: number }>(`SELECT id, number FROM "PickupRequest" WHERE note = $1`, [`Par ${tag}`]);

    for (const s of [opA, opB]) {
      await s.page.goto("/operator");
      await s.page.getByRole("checkbox", { name: `Buyurtma №${r.number} — ${SHOP_NAME.dokon3}ni tanlash` }).check();
      await s.page.getByRole("link", { name: /Vaqt va narxlarni sozlash/ }).click();
      await fillTripBuilder(s.page, { collector: s === opA ? "Akmal" : "Bekzod" });
    }
    await Promise.all([
      opA.page.getByRole("button", { name: /Reysni saqlash/ }).click(),
      opB.page.getByRole("button", { name: /Reysni saqlash/ }).click(),
    ]);
    const outcome = async (s: Session) => {
      const ok = s.page.waitForURL(/\/operator\/trips\/(?!new)[^/?]+$/, { timeout: 20_000 }).then(() => "ok" as const);
      const err = s.page.getByText("Saqlanmadi").waitFor({ timeout: 20_000 }).then(() => "rejected" as const);
      return Promise.race([ok, err]);
    };
    const results = await Promise.all([outcome(opA), outcome(opB)]);
    expect([...results].sort()).toEqual(["ok", "rejected"]);
    const rejectedPage = results[0] === "rejected" ? opA.page : opB.page;
    await expect(rejectedPage.getByText(/allaqachon reysga kiritilgan|boshqa reysga kiritilgan|boshqa foydalanuvchi/)).toBeVisible();

    const stops = await q<{ tripId: string; activeRequestKey: string | null }>(`SELECT "tripId", "activeRequestKey" FROM "TripStop" WHERE "requestId" = $1`, [r.id]);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.activeRequestKey).toBe(r.id);
    const orphan = await q(`SELECT t.id FROM "Trip" t WHERE t."createdAt" > now() - interval '2 minutes' AND NOT EXISTS (SELECT 1 FROM "TripStop" s WHERE s."tripId" = t.id)`);
    expect(orphan).toHaveLength(0);
  } finally {
    await closeAll(d3, opA, opB);
  }
});

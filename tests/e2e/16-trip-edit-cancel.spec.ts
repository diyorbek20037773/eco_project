// 16. Reys tahriri: PLANNED reysda bekatlar tartibi (↑/↓) → DB sequence; bekatni olib tashlash →
// buyurtma NEW va navbatda; sababsiz bekor qilish rad (UI va server); sabab bilan bekor qilish →
// Trip CANCELLED + cancelReason, buyurtmalar NEW va navbatda, yig'uvchining «Bugungi reys»ida yo'q.
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
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
  tripStatus,
  uniqueTag,
  type CreatedRequest,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

async function seqByRequest(tripId: string): Promise<Record<string, { sequence: number; status: string; activeRequestKey: string | null }>> {
  const rows = await q<{ requestId: string; sequence: number; status: string; activeRequestKey: string | null }>(
    `SELECT "requestId", sequence, status::text AS status, "activeRequestKey" FROM "TripStop" WHERE "tripId" = $1`,
    [tripId],
  );
  return Object.fromEntries(rows.map((r) => [r.requestId, { sequence: r.sequence, status: r.status, activeRequestKey: r.activeRequestKey }]));
}

async function requestStatus(id: string): Promise<string> {
  return (await one<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = $1`, [id])).status;
}

/** Operator reys sahifasidagi bekat kartalari tartibi (buyurtma raqamlari). */
async function stopCardOrder(page: Page, numbers: number[]): Promise<number[]> {
  const texts = await page.locator("#stops > ol > li").allInnerTexts();
  return texts.map((t) => numbers.find((n) => t.includes(`№${n} ·`)) ?? -1);
}

function queueCheckbox(page: Page, r: CreatedRequest, shopName: string) {
  return page.getByRole("checkbox", { name: `Buyurtma №${r.number} — ${shopName}ni tanlash` });
}

test("reys tahriri: tartib ↑/↓, bekatni olib tashlash, sababsiz bekor rad, sabab bilan bekor → navbatga qaytish", async ({ browser }) => {
  const tag = uniqueTag("EDIT");
  let d1: Session | undefined, d2: Session | undefined, d3: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    d2 = await loginAs(browser, "dokon2");
    d3 = await loginAs(browser, "dokon3");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi2");

    const A = await createRequestUI(d1.page, { note: `Tahrir A ${tag}`, point: /Nur market — Markaz/ });
    const B = await createRequestUI(d2.page, { note: `Tahrir B ${tag}` });
    const C = await createRequestUI(d3.page, { note: `Tahrir C ${tag}` });
    const nums = [A.number, B.number, C.number];
    const { tripId, tripNumber } = await buildTripUI(
      op.page,
      [
        { number: A.number, shopName: SHOP_NAME.dokon1 },
        { number: B.number, shopName: SHOP_NAME.dokon2 },
        { number: C.number, shopName: SHOP_NAME.dokon3 },
      ],
      "Bekzod",
    );
    let s = await seqByRequest(tripId);
    expect([s[A.id]!.sequence, s[B.id]!.sequence, s[C.id]!.sequence]).toEqual([1, 2, 3]);
    expect(await stopCardOrder(op.page, nums)).toEqual([A.number, B.number, C.number]);

    // Ijobiy nazorat: yig'uvchi bu reysni ko'radi
    const tripLabel = new RegExp(`Reys №${tripNumber} ·`);
    await col.page.goto("/collector");
    await expect(col.page.getByText(tripLabel).first()).toBeVisible();

    // --- 1) Tartib: C ni bir pog'ona yuqoriga → A, C, B
    const editor = op.page.locator("details", { has: op.page.locator("summary", { hasText: "Bekatlar tartibini o‘zgartirish yoki olib tashlash" }) });
    await editor.locator("summary").click();
    const saveOrder = editor.getByRole("button", { name: "Tartibni saqlash" });
    await expect(saveOrder).toBeDisabled(); // o'zgarish yo'q — saqlash faol emas
    await expect(editor.getByRole("button", { name: `№${A.number}ni yuqoriga` })).toBeDisabled();
    await editor.getByRole("button", { name: `№${C.number}ni yuqoriga` }).click();
    await expect(saveOrder).toBeEnabled();
    await saveOrder.click();
    await expect(op.page.getByText("Bekatlar tartibi saqlandi.").first()).toBeVisible();
    await expect.poll(async () => {
      const x = await seqByRequest(tripId);
      return [x[A.id]!.sequence, x[C.id]!.sequence, x[B.id]!.sequence];
    }).toEqual([1, 2, 3]);
    await op.page.reload();
    expect(await stopCardOrder(op.page, nums)).toEqual([A.number, C.number, B.number]);
    expect(await tripStatus(tripId)).toBe("PLANNED");
    const reorderAudit = await q<{ after: { requestIds: string[] } }>(
      `SELECT after FROM "AuditEvent" WHERE "tripId" = $1 AND action = 'TRIP_STOPS_REORDERED' ORDER BY at`,
      [tripId],
    );
    expect(reorderAudit.map((a) => a.after.requestIds)).toEqual([[A.id, C.id, B.id]]);

    // ↓ tugmasi ham ishlaydi: A ni pastga → C, A, B; keyin «Bekor qilish» bilan qaytarish (saqlanmaydi)
    await editor.locator("summary").click();
    await editor.getByRole("button", { name: `№${A.number}ni pastga` }).click();
    await expect(editor.locator("ol > li").first()).toContainText(`№${C.number}`);
    await editor.getByRole("button", { name: "Bekor qilish", exact: true }).click();
    await expect(editor.locator("ol > li").first()).toContainText(`№${A.number}`);
    await expect(saveOrder).toBeDisabled();

    // --- 2) B ni reysdan olib tashlash
    await editor.getByRole("button", { name: `№${B.number}ni reysdan olib tashlash` }).click();
    await expect(editor.getByText("1 ta buyurtma reysdan olinadi va navbatga qaytadi.")).toBeVisible();
    await saveOrder.click();
    await expect(op.page.getByText("Bekatlar tartibi saqlandi.").first()).toBeVisible();
    await expect.poll(async () => (await seqByRequest(tripId))[B.id]!.status).toBe("REMOVED");
    s = await seqByRequest(tripId);
    expect(s[B.id]).toMatchObject({ status: "REMOVED", activeRequestKey: null });
    expect(s[A.id]).toMatchObject({ status: "PENDING", sequence: 1, activeRequestKey: A.id });
    expect(s[C.id]).toMatchObject({ status: "PENDING", sequence: 2, activeRequestKey: C.id });
    expect(await requestStatus(B.id)).toBe("NEW");
    await op.page.reload();
    // Sahifada «Reysdan olib tashlangan: …» qatori bor (page.tsx), lekin loader REMOVED bekatlarni bermaydi.
    // Soft: nuqson dalili yig'iladi, qolgan oqim davom etadi.
    await expect
      .soft(op.page.getByText(`Reysdan olib tashlangan: №${B.number} ${SHOP_NAME.dokon2}`), "Olib tashlangan bekat reys sahifasida ko‘rinishi kerak")
      .toBeVisible({ timeout: 5_000 });
    expect(await stopCardOrder(op.page, nums)).toEqual([A.number, C.number]);
    // Navbatda B yana tanlanadigan, A va C esa yo'q (ular reysda)
    await op.page.goto("/operator");
    await expect(queueCheckbox(op.page, B, SHOP_NAME.dokon2)).toBeVisible();
    await expect(queueCheckbox(op.page, A, SHOP_NAME.dokon1)).toHaveCount(0);
    await expect(queueCheckbox(op.page, C, SHOP_NAME.dokon3)).toHaveCount(0);

    // --- 3) Sababsiz bekor qilish — rad
    await op.page.goto(`/operator/trips/${tripId}`);
    await op.page.getByRole("button", { name: "Reysni bekor qilish" }).click();
    const reason = op.page.getByRole("textbox", { name: /^Bekor qilish sababi/ });
    const confirmCancel = op.page.getByRole("button", { name: "Ha, reysni bekor qilish" });
    // (a) bo'sh maydon
    await confirmCancel.click();
    const native = await reason.evaluate((el: HTMLTextAreaElement) => ({ missing: el.validity.valueMissing, message: el.validationMessage }));
    await expect(op.page.getByText("Bekor qilish sababini yozing.")).toBeVisible(); // noValidate: brauzerning inglizcha xabari emas
    const uzShown = true;
    test.info().annotations.push({ type: "bo‘sh sabab", description: `valueMissing=${native.missing}; brauzer xabari="${native.message}"; o‘zbekcha xabar ko‘rindi=${uzShown}` });
    expect(native.missing || uzShown, "bo‘sh sabab bilan yuborish to‘xtatilishi kerak").toBe(true);
    expect(await tripStatus(tripId)).toBe("PLANNED");
    // (b) faqat bo'shliq / juda qisqa — o'zbekcha xato
    await reason.fill("  ");
    await confirmCancel.click();
    await expect(op.page.getByText("Bekor qilish sababini yozing.")).toBeVisible();
    await expect(op.page.getByText("Sabab majburiy.")).toBeVisible();
    expect(await tripStatus(tripId)).toBe("PLANNED");
    // (c) server ham rad etadi (UI chetlab o'tilsa)
    for (const bad of ["", "ab", "   "]) {
      const res = await callAction(op.page, "cancelTrip", { tripId, reason: bad });
      expect(res.result, `reason=${JSON.stringify(bad)}`).toMatchObject({ ok: false, code: "VALIDATION" });
    }
    expect(await tripStatus(tripId)).toBe("PLANNED");
    expect((await one<{ cancelReason: string | null }>(`SELECT "cancelReason" FROM "Trip" WHERE id = $1`, [tripId])).cancelReason).toBeNull();

    // --- 4) Sabab bilan bekor qilish
    const why = `Mashina buzildi, ertaga qayta rejalashtiramiz ${tag}`;
    await reason.fill(why);
    await confirmCancel.click();
    await expect(op.page.getByText("Reys bekor qilindi. Buyurtmalar navbatga qaytdi.").first()).toBeVisible();
    await expect(op.page.getByText("Reys bekor qilingan")).toBeVisible();
    await expect(op.page.getByText(why).first()).toBeVisible();
    await expect(op.page.getByText("Bekor qilindi", { exact: true }).first()).toBeVisible();
    await expect(op.page.getByRole("button", { name: "Reysni bekor qilish" })).toHaveCount(0);
    await op.page.screenshot({ path: path.join(SCREENS_DIR, "trip-cancelled-operator-1440.png"), fullPage: true });

    const t = await one<{ status: string; cancelReason: string }>(`SELECT status::text AS status, "cancelReason" FROM "Trip" WHERE id = $1`, [tripId]);
    expect(t).toEqual({ status: "CANCELLED", cancelReason: why });
    s = await seqByRequest(tripId);
    for (const r of [A, B, C]) expect(s[r.id], `bekat ${r.number}`).toMatchObject({ status: "REMOVED", activeRequestKey: null });
    for (const r of [A, B, C]) expect(await requestStatus(r.id), `buyurtma ${r.number}`).toBe("NEW");
    const cancelAudit = await q<{ reason: string }>(`SELECT reason FROM "AuditEvent" WHERE "tripId" = $1 AND action = 'TRIP_CANCELLED'`, [tripId]);
    expect(cancelAudit).toEqual([{ reason: why }]);

    // Takroriy bekor qilish — yangi audit yo'q (idempotent)
    const again = await callAction(op.page, "cancelTrip", { tripId, reason: why });
    expect(again.result).toMatchObject({ ok: true, replayed: true });
    expect((await q(`SELECT 1 FROM "AuditEvent" WHERE "tripId" = $1 AND action = 'TRIP_CANCELLED'`, [tripId])).length).toBe(1);

    // Navbatda uchala buyurtma ham tanlanadigan
    await op.page.goto("/operator");
    await expect(queueCheckbox(op.page, A, SHOP_NAME.dokon1)).toBeVisible();
    await expect(queueCheckbox(op.page, B, SHOP_NAME.dokon2)).toBeVisible();
    await expect(queueCheckbox(op.page, C, SHOP_NAME.dokon3)).toBeVisible();

    // Yig'uvchining «Bugungi reys»ida bu reys yo'q
    await col.page.goto("/collector");
    await expect(col.page.getByRole("heading", { name: "Keyingi kunlar" })).toBeVisible();
    await expect(col.page.getByText(tripLabel)).toHaveCount(0);

    // Do'kon: buyurtma yana «Yangi», reys ma'lumoti yo'q
    await d1.page.goto(`/shop/requests/${A.id}`);
    await expect(d1.page.getByText("Buyurtma navbatda. Operator uni reysga qo‘shishi kutilmoqda.")).toBeVisible();
  } finally {
    await closeAll(d1, d2, d3, op, col);
  }
});

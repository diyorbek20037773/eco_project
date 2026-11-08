// 6. Ruxsatsiz murojaat: begona do'kon / yig'uvchi URL yoki ID almashtirib boshqa nuqta, reys,
// foto yoki pul yozuvini ololmaydi; rol mos kelmasa redirect; sessiyasiz → /login va API → 401.
import { test, expect, type Page } from "@playwright/test";
import {
  FIXTURE_KARTON,
  SHOP_NAME,
  buildTripUI,
  callAction,
  closeAll,
  closeDb,
  createRequestUI,
  loginAs,
  one,
  stopForRequest,
  uniqueTag,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

async function status(page: Page, url: string): Promise<{ status: number; body: string; finalPath: string }> {
  const res = await page.goto(url);
  return { status: res?.status() ?? 0, body: await page.content(), finalPath: new URL(page.url()).pathname };
}

test("ruxsatsiz murojaat: begona buyurtma, rasm, reys, bekat → 404; rol → redirect; sessiyasiz → /login va 401", async ({ browser }) => {
  const tag = uniqueTag("ACL");
  let d1: Session | undefined, d2: Session | undefined, op: Session | undefined, c1: Session | undefined, c2: Session | undefined;
  const anon = await browser.newContext();
  try {
    d1 = await loginAs(browser, "dokon1");
    d2 = await loginAs(browser, "dokon2");
    op = await loginAs(browser, "operator");
    c1 = await loginAs(browser, "yiguvchi1");
    c2 = await loginAs(browser, "yiguvchi2");

    const r = await createRequestUI(d1.page, { note: `Maxfiy ${tag}`, point: /Nur market — Markaz/, photo: FIXTURE_KARTON });
    const att = await one<{ id: string }>(`SELECT id FROM "Attachment" WHERE "requestId" = $1`, [r.id]);
    const { tripId } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon1 }], "Akmal");
    const stopId = await stopForRequest(tripId, r.id);

    // --- Ijobiy nazorat: egalari ko'radi
    expect((await status(d1.page, `/api/requests/${r.id}`)).status).toBe(200);
    const own = await d1.page.goto(`/api/files/${att.id}`);
    expect(own?.status()).toBe(200);
    expect(own?.headers()["content-type"]).toBe("image/png");
    expect((await status(op.page, `/api/trips/${tripId}`)).status).toBe(200);
    expect((await status(c1.page, `/api/trips/${tripId}`)).status).toBe(200);
    const c1stop = await status(c1.page, `/collector/stops/${stopId}`);
    expect(c1stop.status).toBe(200);
    expect(c1stop.body).toContain(`Maxfiy ${tag}`);

    // --- dokon2 (boshqa do'kon)
    const page404 = await status(d2.page, `/shop/requests/${r.id}`);
    await expect(d2.page.getByText("Buyurtma topilmadi")).toBeVisible();
    expect(page404.body).not.toContain(`Maxfiy ${tag}`);
    // Soft: test yiqiladi, lekin qolgan ruxsat tekshiruvlari ham bajariladi (dalil to‘plami).
    expect.soft(page404.status, "Sahifa: begona buyurtma HTTP 404 qaytarishi kerak").toBe(404);
    for (const url of [`/api/requests/${r.id}`, `/api/files/${att.id}`, `/api/trips/${tripId}`]) {
      const res = await status(d2.page, url);
      expect(res.status, url).toBe(404);
      expect(res.body, url).not.toContain(`Maxfiy ${tag}`);
    }
    // Server action: begona bekat vaznini tasdiqlash / e'tiroz — NOT_FOUND
    await d2.page.goto("/shop");
    const foreignConfirm = await callAction(d2.page, "confirmStopWeight", { stopId });
    expect(foreignConfirm.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    // Do'kon operator amalini chaqira olmaydi
    const shopClose = await callAction(d2.page, "closeTrip", { tripId });
    expect(shopClose.result).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // --- yiguvchi2 (boshqa yig'uvchi)
    const c2stop = await status(c2.page, `/collector/stops/${stopId}`);
    await expect(c2.page.getByText("Topilmadi", { exact: true })).toBeVisible();
    expect(c2stop.body).not.toContain(`Maxfiy ${tag}`);
    expect.soft(c2stop.status, "Sahifa: begona bekat HTTP 404 qaytarishi kerak").toBe(404);
    const c2trip = await status(c2.page, `/api/trips/${tripId}`);
    expect(c2trip.status).toBe(404);
    expect((await status(c2.page, `/api/files/${att.id}`)).status).toBe(404);
    await c2.page.goto("/collector");
    const foreignWeigh = await callAction(c2.page, "recordWeighing", { stopId, clientKey: crypto.randomUUID(), grossKg: "10", tareKg: "0" });
    expect(foreignWeigh.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM "Weighing" WHERE "stopId" = $1`, [stopId])).n).toBe(0);

    // --- Rol mos kelmasa redirect
    expect((await status(d1.page, "/operator")).finalPath).toBe("/shop");
    expect((await status(d1.page, `/operator/trips/${tripId}`)).finalPath).toBe("/shop");
    expect((await status(d1.page, "/collector")).finalPath).toBe("/shop");
    expect((await status(c1.page, "/operator/directory")).finalPath).toBe("/collector");
    expect((await status(op.page, "/shop/new")).finalPath).toBe("/operator");

    // --- Sessiyasiz
    const ap = await anon.newPage();
    for (const url of ["/shop", "/operator", `/operator/trips/${tripId}`, `/collector/stops/${stopId}`, `/shop/requests/${r.id}`]) {
      expect((await status(ap, url)).finalPath, url).toBe("/login");
    }
    for (const url of [`/api/requests/${r.id}`, `/api/trips/${tripId}`, `/api/files/${att.id}`]) {
      expect((await status(ap, url)).status, url).toBe(401);
    }
    await ap.goto("/login");
    const anonAction = await callAction(ap, "closeTrip", { tripId });
    expect(anonAction.result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  } finally {
    await closeAll(d1, d2, op, c1, c2);
    await anon.close();
  }
});

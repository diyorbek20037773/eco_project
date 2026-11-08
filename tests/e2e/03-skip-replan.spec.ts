// 3. Qoldirish va qayta rejalash: yig'uvchi «Karton tayyor emas» (sabab) → operator navbatda
// «Qoldirildi» ni ko'radi → boshqa reysga kiritadi. Bitta buyurtma ikkita faol reysda emas.
import { test, expect } from "@playwright/test";
import {
  SHOP_NAME,
  buildTripUI,
  closeAll,
  closeDb,
  createRequestUI,
  fillTripBuilder,
  loginAs,
  one,
  q,
  selectInQueue,
  stopForRequest,
  submitTripBuilder,
  tripStatus,
  uniqueTag,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

test("qoldirish (sabab bilan) → navbatda «Qoldirildi» → boshqa reysga qayta rejalash", async ({ browser }) => {
  const tag = uniqueTag("SKIP");
  let d3: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d3 = await loginAs(browser, "dokon3");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi2");

    const r = await createRequestUI(d3.page, { note: `Skip ${tag}` });
    const t1 = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon3 }], "Bekzod");
    const stop1 = await stopForRequest(t1.tripId, r.id);

    // Yig'uvchi: «Karton tayyor emas» + izoh
    await col.page.goto(`/collector/stops/${stop1}`);
    await col.page.getByRole("button", { name: "Karton tayyor emas" }).click();
    await expect(col.page.getByRole("heading", { name: "Nuqtani qoldirish" })).toBeVisible();
    await expect(col.page.getByRole("radio", { name: "Karton tayyor emas" })).toBeChecked();
    await col.page.getByRole("textbox", { name: /^Izoh/ }).fill(`ertaga 10:00 dan keyin ${tag}`);
    await col.page.getByRole("button", { name: "Qoldirishni tasdiqlash" }).click();
    await expect(col.page.getByText("Nuqta qoldirildi")).toBeVisible();

    const s1 = await one<{ status: string; skipReason: string; activeRequestKey: string | null }>(
      `SELECT status::text AS status, "skipReason", "activeRequestKey" FROM "TripStop" WHERE id = $1`,
      [stop1],
    );
    expect(s1.status).toBe("SKIPPED");
    expect(s1.skipReason).toBe(`Karton tayyor emas: ertaga 10:00 dan keyin ${tag}`);
    expect(s1.activeRequestKey).toBeNull();
    expect((await one<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = $1`, [r.id])).status).toBe("SKIPPED");
    // Yagona bekat qoldirildi → reys bekor qilinadi (kontrakt §3).
    expect(await tripStatus(t1.tripId)).toBe("CANCELLED");

    // Do'kon o'z buyurtmasida qoldirish sababini ko'radi
    await d3.page.goto(`/shop/requests/${r.id}`);
    await expect(d3.page.getByText(`ertaga 10:00 dan keyin ${tag}`)).toBeVisible();

    // Operator: navbatda «Qoldirildi» belgisi va sabab
    await selectInQueue(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon3 }]);
    const flagged = op.page.getByRole("row").filter({ hasText: `Skip ${tag}` });
    await expect(flagged).toContainText("Qoldirildi: Karton tayyor emas");
    await op.page.getByRole("link", { name: "Reys tuzish (1)" }).click();
    await fillTripBuilder(op.page, { collector: "Bekzod" });
    await expect(op.page.getByText(/^Qoldirilgan: Karton tayyor emas/)).toBeVisible();
    const t2 = await submitTripBuilder(op.page);
    expect(t2.tripId).not.toBe(t1.tripId);

    const stops = await q<{ tripId: string; status: string; activeRequestKey: string | null }>(
      `SELECT "tripId", status::text AS status, "activeRequestKey" FROM "TripStop" WHERE "requestId" = $1 ORDER BY "createdAt"`,
      [r.id],
    );
    expect(stops).toEqual([
      { tripId: t1.tripId, status: "SKIPPED", activeRequestKey: null },
      { tripId: t2.tripId, status: "PENDING", activeRequestKey: r.id },
    ]);
    expect((await one<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = $1`, [r.id])).status).toBe("PLANNED");

    // Yig'uvchi yangi reysda bekatni ko'radi
    const stop2 = await stopForRequest(t2.tripId, r.id);
    await col.page.goto(`/collector/stops/${stop2}`);
    await expect(col.page.getByRole("button", { name: "Tortishni saqlash" })).toBeVisible();
  } finally {
    await closeAll(d3, op, col);
  }
});

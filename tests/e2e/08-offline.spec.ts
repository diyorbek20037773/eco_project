// 8. Tarmoq uzilishi: offline holatda forma yuborish → «Qayta yuborish», qiymatlar saqlangan →
// online → qayta yuborish → muvaffaqiyat, DB'da bitta yozuv (xuddi shu clientKey).
import { test, expect } from "@playwright/test";
import {
  SHOP_NAME,
  buildTripUI,
  closeAll,
  closeDb,
  fillWeighing,
  loginAs,
  one,
  q,
  stopForRequest,
  uniqueTag,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

test("offline: «Olib keting» va tortish formasi qiymatlarni saqlaydi, «Qayta yuborish» bitta yozuv beradi", async ({ browser }) => {
  const tag = uniqueTag("OFF");
  let d2: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d2 = await loginAs(browser, "dokon2");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi2");

    // --- Do'kon: «Olib keting» offline
    await d2.page.goto("/shop/new");
    await d2.page.getByRole("radio", { name: /Tarozim bor/ }).check();
    await d2.page.getByRole("textbox", { name: /^Taxminiy vazn/ }).fill("25,5");
    const note = `Offline ${tag}`;
    await d2.page.getByRole("textbox", { name: /^Izoh/ }).fill(note);
    await d2.context.setOffline(true);
    await d2.page.getByRole("button", { name: "Yuborish" }).click();
    await expect(d2.page.getByText("Yuborilmadi")).toBeVisible();
    await expect(d2.page.getByText("Internet aloqasi yo‘q. Ma’lumotlar saqlandi — «Qayta yuborish»ni bosing.")).toBeVisible();
    await expect(d2.page.getByRole("textbox", { name: /^Izoh/ })).toHaveValue(note);
    await expect(d2.page.getByRole("textbox", { name: /^Taxminiy vazn/ })).toHaveValue("25,5");
    expect((await q(`SELECT 1 FROM "PickupRequest" WHERE note = $1`, [note])).length).toBe(0);
    // Qoralama localStorage'da
    const draft = await d2.page.evaluate(() => localStorage.getItem("ecopoint:draft:shop-new-request"));
    expect(draft).toContain(note);

    await d2.context.setOffline(false);
    await d2.page.getByRole("button", { name: "Qayta yuborish" }).click();
    await d2.page.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
    const rows = await q<{ id: string; number: number; estimatedGrams: number }>(`SELECT id, number, "estimatedGrams" FROM "PickupRequest" WHERE note = $1`, [note]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.estimatedGrams).toBe(25_500);
    const r = rows[0]!;

    // --- Yig'uvchi: tortish offline
    const { tripId } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon2 }], "Bekzod");
    const stopId = await stopForRequest(tripId, r.id);
    await col.page.goto(`/collector/stops/${stopId}`);
    await fillWeighing(col.page, "27,2", "1,2");
    await expect(col.page.locator("output")).toHaveText("26 kg");
    await col.context.setOffline(true);
    await col.page.getByRole("button", { name: "Tortishni saqlash" }).click();
    await expect(col.page.getByText("Yuborilmadi")).toBeVisible();
    await expect(col.page.getByRole("button", { name: "Qayta yuborish" })).toBeVisible();
    await expect(col.page.getByRole("textbox", { name: /^Brutto/ })).toHaveValue("27,2");
    await expect(col.page.getByRole("textbox", { name: /^Tara/ })).toHaveValue("1,2");
    // Ikki marta «Qayta yuborish» offline — hali ham yozuv yo'q
    await col.page.getByRole("button", { name: "Qayta yuborish" }).click();
    await expect(col.page.getByText("Yuborilmadi")).toBeVisible();
    expect((await q(`SELECT 1 FROM "Weighing" WHERE "stopId" = $1`, [stopId])).length).toBe(0);

    await col.context.setOffline(false);
    await col.page.getByRole("button", { name: "Qayta yuborish" }).click();
    await expect(col.page.getByText("Saqlandi: 26 kg")).toBeVisible();
    const w = await one<{ n: number; net: number }>(`SELECT count(*)::int AS n, max("netGrams")::int AS net FROM "Weighing" WHERE "stopId" = $1`, [stopId]);
    expect(w).toEqual({ n: 1, net: 26_000 });
  } finally {
    await closeAll(d2, op, col);
  }
});

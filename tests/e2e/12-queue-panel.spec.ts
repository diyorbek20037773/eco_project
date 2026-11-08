// 12. Navbat dashboardi: «Yangi reys» paneli — tanlash, tartibni o'zgartirish, yig'uvchi/xaridor,
// «Reys yaratish» to'g'ridan-to'g'ri reys tuzadi (tarif narxlari nusxasi, tanlangan tartib).
import { test, expect } from "@playwright/test";
import { SHOP_NAME, closeAll, closeDb, createRequestUI, loginAs, one, q, uniqueTag, type Session } from "./helpers";

test.afterAll(closeDb);

test("navbat paneli: 2 bekat → tartib ↓ → yig‘uvchi va xaridor → «Reys yaratish»", async ({ browser }) => {
  const tag = uniqueTag("PANEL");
  let d1: Session | undefined, d3: Session | undefined, op: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    d3 = await loginAs(browser, "dokon3");
    op = await loginAs(browser, "operator");

    const a = await createRequestUI(d1.page, { note: `A ${tag}`, estimatedKg: "40", point: /Markaz/ });
    const b = await createRequestUI(d3.page, { note: `B ${tag}`, estimatedKg: "35" });

    const page = op.page;
    await page.goto("/operator");
    await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar navbati" })).toBeVisible();
    const panel = page.locator("#new-trip");
    await expect(panel.getByRole("button", { name: "Reys yaratish" })).toBeDisabled();

    await page.getByRole("checkbox", { name: `Buyurtma №${a.number} — ${SHOP_NAME.dokon1}ni tanlash` }).check();
    await page.getByRole("checkbox", { name: `Buyurtma №${b.number} — ${SHOP_NAME.dokon3}ni tanlash` }).check();
    await expect(panel.getByText("2 ta nuqta", { exact: true })).toBeVisible();
    await expect(panel.getByRole("img", { name: /Bekatlar tartibi: 1 — / })).toBeVisible();

    // Tartibni almashtirish: 1-bekatni pastga → dokon3 birinchi
    await panel.getByRole("button", { name: `${SHOP_NAME.dokon1}ni pastga` }).click();
    await expect(panel.locator("ol > li").first()).toContainText(SHOP_NAME.dokon3);

    // Majburiy tanlovlarsiz yuborish — xato
    await panel.getByRole("button", { name: "Reys yaratish" }).click();
    await expect(panel.getByText("Yig‘uvchini tanlang.")).toBeVisible();

    const collector = panel.getByRole("combobox", { name: /^Yig‘uvchi/ });
    const cv = await collector.locator("option", { hasText: "Akmal" }).first().getAttribute("value");
    await collector.selectOption(cv!);
    const buyer = panel.getByRole("combobox", { name: /^Xaridor/ });
    const bv = await buyer.locator("option", { hasText: "Qarshi qog‘oz" }).first().getAttribute("value");
    await buyer.selectOption(bv!);
    await expect(panel.getByText(/Minimal partiya:/)).toBeVisible();
    await panel.getByText("Xaridorning sifat sharti").click();
    await expect(panel.getByText(/Quruq, toza karton/)).toBeVisible();

    await panel.getByRole("button", { name: "Reys yaratish" }).click();
    await page.waitForURL(/\/operator\/trips\/(?!new)[^/?]+$/, { timeout: 30_000 });
    const tripId = new URL(page.url()).pathname.split("/").pop()!;

    const trip = await one<{ shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number; status: string }>(
      `SELECT "shopPricePerKg", "buyerPricePerKg", "serviceFee", status::text AS status FROM "Trip" WHERE id = $1`,
      [tripId],
    );
    expect(trip).toMatchObject({ shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000, status: "PLANNED" });
    const stops = await q<{ requestId: string; sequence: number }>(
      `SELECT "requestId", sequence FROM "TripStop" WHERE "tripId" = $1 AND status <> 'REMOVED' ORDER BY sequence`,
      [tripId],
    );
    expect(stops.map((s) => s.requestId)).toEqual([b.id, a.id]);
  } finally {
    await closeAll(d1, d3, op);
  }
});

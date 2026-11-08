// 10. Klaviatura: login sahifasida Tab bilan maydon va tugmaga o'tish, ko'rinadigan fokus, Enter bilan kirish.
import { test, expect, type Page } from "@playwright/test";

async function tabUntil(page: Page, predicate: string, max = 15): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, predicate);
    if (hit) return i;
  }
  throw new Error(`Tab bilan "${predicate}" ga yetib bo‘lmadi`);
}

async function focusRing(page: Page): Promise<{ outline: string; width: number; boxShadow: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth), boxShadow: cs.boxShadow };
  });
}

test("klaviatura: Tab → login → parol → «Kirish», ko‘rinadigan fokus, Enter bilan kirish", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto("/login");
    // Birinchi Tab — «Asosiy qismga o‘tish» havolasi ko'rinadi
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Asosiy qismga o‘tish" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await tabUntil(page, 'input[name="login"]');
    let ring = await focusRing(page);
    expect(ring.outline !== "none" || ring.boxShadow !== "none", `login fokus halqasi: ${JSON.stringify(ring)}`).toBe(true);
    await page.keyboard.type("operator");

    await page.keyboard.press("Tab");
    await expect(page.locator('input[name="password"]')).toBeFocused();
    await page.keyboard.type("EcoDemo2026!");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Kirish" })).toBeFocused();
    ring = await focusRing(page);
    expect(ring.outline !== "none" && ring.width >= 2, `tugma fokus halqasi: ${JSON.stringify(ring)}`).toBe(true);

    // Enter parol maydonida formani yuboradi
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator('input[name="password"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/operator$/);

    // Noto'g'ri parol: xato matni o'zbekcha va fokus formada qoladi
    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    await p2.goto("/login");
    await p2.getByLabel(/^Login/).fill("operator");
    await p2.getByLabel(/^Parol/).fill("notogri-parol");
    await p2.getByLabel(/^Parol/).press("Enter");
    await expect(p2.getByText("Login yoki parol noto‘g‘ri.")).toBeVisible();
    await expect(p2).toHaveURL(/\/login$/);
    await c2.close();
  } finally {
    await context.close();
  }
});

test("klaviatura: do‘kon «Olib keting» formasini faqat klaviatura bilan yuborish", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto("/login");
    await page.getByLabel(/^Login/).fill("dokon3");
    await page.getByLabel(/^Parol/).fill("EcoDemo2026!");
    await page.getByLabel(/^Parol/).press("Enter");
    await page.waitForURL(/\/shop$/);
    // Sahifa to‘liq yuklanib, gidratsiya tugashini kutamiz — kech navigatsiya fokusni boshiga qaytarmasin.
    await expect(page.getByRole("link", { name: "Olib keting" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await tabUntil(page, 'a[href="/shop/new"]', 25);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/shop\/new$/);
    await tabUntil(page, "textarea", 40);
    const note = `Klaviatura ${Date.now().toString(36)}`;
    await page.keyboard.type(note);
    await tabUntil(page, 'button[type="submit"]', 10);
    const ring = await focusRing(page);
    expect(ring.outline !== "none" && ring.width >= 2, `«Yuborish» fokus halqasi: ${JSON.stringify(ring)}`).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
    await expect(page.getByText(/Buyurtma №\d+ yuborildi/)).toBeVisible();
  } finally {
    await context.close();
  }
});

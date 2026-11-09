// 14. Telegram’da ulashish: t.me/share havolasi (bot tokenisiz), «Havolani nusxalash» clipboard'ga
// reys havolasini yozadi; havola autentifikatsiya talab qiladi (sessiyasiz → /login, boshqa rol → o'z bo'limi).
import path from "node:path";
import { test, expect } from "@playwright/test";
import { SCREENS_DIR, closeAll, closeDb, loginAs, one, type Session } from "./helpers";

test.afterAll(closeDb);

test("reys sahifasi: Telegram havolasi to‘g‘ri, nusxalash clipboard’ga yozadi, havola sessiyasiz ochilmaydi", async ({ browser, baseURL }) => {
  expect(baseURL).toBeTruthy();
  let op: Session | undefined, d1: Session | undefined;
  const anon = await browser.newContext();
  try {
    op = await loginAs(browser, "operator");
    // Seed reysi (kechagi namunaviy reys) — faqat o'qiladi.
    const trip = await one<{ id: string; number: number }>(`SELECT id, number FROM "Trip" WHERE "clientKey" = 'seed-sample-trip'`);
    const shareUrl = `${baseURL}/operator/trips/${trip.id}`;

    await op.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
    await op.page.goto(`/operator/trips/${trip.id}`);
    await expect(op.page.getByRole("heading", { level: 1, name: `Reys №${trip.number}` })).toBeVisible();

    // --- Telegram havolasi
    const tg = op.page.getByRole("link", { name: "Telegram’da ulashish" });
    await expect(tg).toBeVisible();
    const href = (await tg.getAttribute("href"))!;
    expect(href.startsWith(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`), href).toBe(true);
    const u = new URL(href);
    expect(u.origin).toBe("https://t.me");
    expect(u.pathname).toBe("/share/url");
    expect(u.searchParams.get("url")).toBe(shareUrl);
    expect(u.searchParams.get("text")).toContain(`Reys №${trip.number}`);
    await expect(tg).toHaveAttribute("target", "_blank");
    const rel = ((await tg.getAttribute("rel")) ?? "").split(/\s+/);
    expect(rel).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    await expect(op.page.getByText("Havola faqat tizimga kirgan operatorga ochiladi.")).toBeVisible();

    // --- Nusxalash
    await op.page.getByRole("button", { name: "Havolani nusxalash" }).click();
    await expect(op.page.getByText("Havola nusxalandi.")).toBeVisible();
    const clip = await op.page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(shareUrl);
    await op.page.screenshot({ path: path.join(SCREENS_DIR, "telegram-share-copied-1440.png") });

    // --- Havola autentifikatsiya talab qiladi
    const ap = await anon.newPage();
    const res = await ap.goto(shareUrl);
    expect(new URL(ap.url()).pathname).toBe("/login");
    expect(res?.status()).toBeLessThan(400);
    expect(await ap.content()).not.toContain(`Reys №${trip.number}`);
    await expect(ap.getByRole("button", { name: "Kirish" })).toBeVisible();

    // Boshqa rol (do'kon) — operator reysi ochilmaydi, o'z bo'limiga qaytariladi.
    d1 = await loginAs(browser, "dokon1");
    await d1.page.goto(shareUrl);
    expect(new URL(d1.page.url()).pathname).toBe("/shop");
  } finally {
    await closeAll(op, d1);
    await anon.close();
  }
});

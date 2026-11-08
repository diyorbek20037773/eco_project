// 9. Mobil/desktop: 3 rolning asosiy ekranlari 360, 390 va 1440 px'da.
// Har ekran: fullPage screenshot → test-results/screens/<nom>-<w>.png; gorizontal scroll yo'q;
// ko'rinadigan button/a/input/select/summary ≥ 44 px (matn ichidagi inline havolalardan tashqari);
// matn kontrasti (≥ 4.5:1, katta matn ≥ 3:1); kesilgan (ellipsis) matn ro'yxati.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import {
  SCREENS_DIR,
  SHOP_NAME,
  buildTripUI,
  closeAll,
  closeDb,
  createRequestUI,
  loginAs,
  one,
  q,
  stopForRequest,
  uniqueTag,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

interface Ids {
  requestId: string;
  stopId: string;
  tripId: string;
  newTripIds: string;
}
let ids: Ids;

test.beforeAll(async ({ browser }) => {
  const tag = uniqueTag("LAY");
  const d1 = await loginAs(browser, "dokon1");
  const op = await loginAs(browser, "operator");
  try {
    const r = await createRequestUI(d1.page, { note: `Layout ${tag}: orqa eshikdan, qo‘riqchiga ayting`, point: /Nur market — Markaz/ });
    const { tripId: layoutTrip } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon1 }], "Akmal");
    const stopId = await stopForRequest(layoutTrip, r.id);
    const sample = await one<{ id: string }>(`SELECT id FROM "Trip" WHERE "clientKey" = 'seed-sample-trip'`);
    const open = await q<{ id: string }>(`SELECT id FROM "PickupRequest" WHERE status IN ('NEW','SKIPPED') ORDER BY number LIMIT 3`);
    ids = { requestId: r.id, stopId, tripId: sample.id, newTripIds: open.map((o) => o.id).join(",") };
  } finally {
    await closeAll(d1, op);
  }
});

interface Audit {
  scrollWidth: number;
  innerWidth: number;
  small: { tag: string; text: string; w: number; h: number }[];
  narrow: { tag: string; text: string; w: number; h: number }[];
  lowContrast: { text: string; ratio: number; fg: string; bg: string; size: number }[];
  truncated: string[];
}

async function auditPage(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const toRgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const blend = (top: [number, number, number, number], under: [number, number, number]): [number, number, number] => [
      top[0] * top[3] + under[0] * (1 - top[3]),
      top[1] * top[3] + under[1] * (1 - top[3]),
      top[2] * top[3] + under[2] * (1 - top[3]),
    ];
    const effectiveBg = (el: Element): [number, number, number] => {
      const chain: [number, number, number, number][] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = toRgba(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) chain.push(c);
        if (c[3] >= 1) break;
      }
      let base: [number, number, number] = [255, 255, 255];
      for (let i = chain.length - 1; i >= 0; i--) base = blend(chain[i]!, base);
      return base;
    };
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const label = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute("aria-label") || el.getAttribute("name") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 60);

    const small: Audit["small"] = [];
    const narrow: Audit["narrow"] = [];
    for (const el of Array.from(document.querySelectorAll("button, a[href], input, select, textarea, summary"))) {
      if (el.closest('[aria-hidden="true"]')) continue;
      let target: Element = el;
      const type = el.getAttribute("type");
      if (el.tagName === "INPUT" && type === "hidden") continue;
      if (el.tagName === "INPUT" && (type === "checkbox" || type === "radio" || type === "file")) {
        const lab = el.closest("label");
        if (!lab) {
          if (type === "file") continue;
        } else target = lab;
      }
      if (!visible(target)) continue;
      const cs = getComputedStyle(el);
      if (el.tagName === "A" && cs.display === "inline") {
        const parentText = (el.parentElement?.textContent ?? "").trim();
        const ownText = (el.textContent ?? "").trim();
        if (parentText.length > ownText.length) continue; // matn ichidagi inline havola
      }
      const r = target.getBoundingClientRect();
      const item = { tag: el.tagName.toLowerCase() + (type ? `[${type}]` : ""), text: label(target), w: Math.round(r.width), h: Math.round(r.height) };
      if (r.height < 43.5) small.push(item);
      else if (r.width < 43.5) narrow.push(item);
    }

    const lowContrast: Audit["lowContrast"] = [];
    const truncated: string[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (!visible(el)) continue;
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0);
      if (!hasText) continue;
      if (el.closest("[disabled], [aria-disabled='true']")) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.position === "absolute" && r.width <= 1) continue;
      let alpha = 1;
      for (let n: Element | null = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
      if (alpha < 0.99) continue;
      const fgA = toRgba(cs.color);
      const bg = effectiveBg(el);
      const fg = blend(fgA, bg);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
      if (ratio < need && !seen.has(text)) {
        seen.add(text);
        lowContrast.push({ text, ratio: Math.round(ratio * 100) / 100, fg: `rgb(${fg.map(Math.round).join(",")})`, bg: `rgb(${bg.map(Math.round).join(",")})`, size });
      }
      if ((cs.textOverflow === "ellipsis" || cs.overflow === "hidden" || cs.overflowX === "hidden") && el.scrollWidth > el.clientWidth + 1) truncated.push(text);
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, small, narrow, lowContrast, truncated };
  });
}

const WIDTHS = [360, 390, 1440] as const;

for (const width of WIDTHS) {
  test(`asosiy ekranlar ${width}px: screenshot, gorizontal scroll yo‘q, ≥44px, kontrast`, async ({ browser }) => {
    const viewport = { width, height: width === 1440 ? 900 : 800 };
    const sessions: Session[] = [];
    const anon = await browser.newContext({ viewport });
    try {
      const shop = await loginAs(browser, "dokon1", viewport);
      const col = await loginAs(browser, "yiguvchi1", viewport);
      const op = await loginAs(browser, "operator", viewport);
      sessions.push(shop, col, op);
      const loginPage = await anon.newPage();

      const screens: { name: string; page: Page; url: string; ready: (p: Page) => Promise<void> }[] = [
        { name: "login", page: loginPage, url: "/login", ready: (p) => expect(p.getByRole("button", { name: "Kirish" })).toBeVisible() },
        { name: "shop-home", page: shop.page, url: "/shop", ready: (p) => expect(p.getByRole("link", { name: "Olib keting" })).toBeVisible() },
        { name: "shop-new", page: shop.page, url: "/shop/new", ready: (p) => expect(p.getByRole("button", { name: "Yuborish" })).toBeVisible() },
        { name: "shop-request", page: shop.page, url: `/shop/requests/${ids.requestId}`, ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
        { name: "collector-today", page: col.page, url: "/collector", ready: (p) => expect(p.getByRole("link", { name: "Tortishni kiritish" })).toBeVisible() },
        { name: "collector-stop", page: col.page, url: `/collector/stops/${ids.stopId}`, ready: (p) => expect(p.getByRole("button", { name: "Tortishni saqlash" })).toBeVisible() },
        { name: "operator-queue", page: op.page, url: "/operator", ready: (p) => expect(p.getByRole("heading", { name: "Buyurtmalar navbati", level: 1 })).toBeVisible() },
        { name: "operator-trip-new", page: op.page, url: `/operator/trips/new?ids=${ids.newTripIds}`, ready: (p) => expect(p.getByRole("button", { name: /Reysni saqlash/ })).toBeVisible() },
        { name: "operator-trip", page: op.page, url: `/operator/trips/${ids.tripId}`, ready: (p) => expect(p.getByRole("heading", { name: /^Reys №/, level: 1 })).toBeVisible() },
        { name: "operator-directory", page: op.page, url: "/operator/directory", ready: (p) => expect(p.getByRole("heading", { name: "Katalog", level: 1 })).toBeVisible() },
      ];

      const summary: Record<string, Omit<Audit, "scrollWidth" | "innerWidth"> & { overflow: string }> = {};
      for (const s of screens) {
        const res = await s.page.goto(s.url);
        expect(res?.status(), `${s.name}: HTTP`).toBe(200);
        await s.ready(s.page);
        await s.page.waitForLoadState("networkidle");
        const file = path.join(SCREENS_DIR, `${s.name}-${width}.png`);
        await s.page.screenshot({ path: file, fullPage: true });
        const a = await auditPage(s.page);
        summary[s.name] = { overflow: `${a.scrollWidth}/${a.innerWidth}`, small: a.small, narrow: a.narrow, lowContrast: a.lowContrast, truncated: a.truncated };
        expect.soft(a.scrollWidth, `${s.name}-${width}: gorizontal scroll (scrollWidth > innerWidth)`).toBeLessThanOrEqual(a.innerWidth);
        expect.soft(a.small, `${s.name}-${width}: 44px dan past bosiladigan elementlar`).toEqual([]);
        expect.soft(a.narrow, `${s.name}-${width}: 44px dan tor bosiladigan elementlar (balandligi yetarli, kengligi < 44)`).toEqual([]);
        expect.soft(a.lowContrast, `${s.name}-${width}: kontrast yetarli emas`).toEqual([]);
      }
      test.info().annotations.push({ type: "layout-audit", description: JSON.stringify(summary) });
      await test.info().attach(`layout-audit-${width}.json`, { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
      writeFileSync(path.join(SCREENS_DIR, `layout-audit-${width}.json`), JSON.stringify(summary, null, 2));
    } finally {
      await closeAll(...sessions);
      await anon.close();
    }
  });
}

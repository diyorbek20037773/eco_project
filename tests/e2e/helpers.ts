// E2E yordamchilari: alohida sessiyalar, UI orqali oqim qadamlari, TEST bazasidan o'qish,
// server action'ni brauzer ichidan to'g'ridan-to'g'ri chaqirish (ruxsat/o'tish sinovlari uchun).
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import pg from "pg";

export const PASSWORD = "EcoDemo2026!";
export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const FIXTURE_KARTON = path.join(ROOT, "tests", "e2e", "fixtures", "karton.png");
export const FIXTURE_TAROZI = path.join(ROOT, "tests", "e2e", "fixtures", "tarozi.png");
export const SCREENS_DIR = path.join(ROOT, "test-results", "screens");

export const DESKTOP = { width: 1440, height: 900 };
export const PHONE = { width: 390, height: 844 };

export type Login = "operator" | "dokon1" | "dokon2" | "dokon3" | "yiguvchi1" | "yiguvchi2";

export const SHOP_NAME: Record<"dokon1" | "dokon2" | "dokon3", string> = {
  dokon1: "Nur market",
  dokon2: "Bahor savdo",
  dokon3: "Oila supermarketi",
};

// ---------------------------------------------------------------------------
// TEST bazasi (faqat o'qish + tekshiruv)
// ---------------------------------------------------------------------------
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint_test";
if (!decodeURIComponent(new URL(TEST_DB).pathname).endsWith("_test")) throw new Error("E2E faqat *_test bazasida ishlaydi.");

let pool: pg.Pool | null = null;
function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: TEST_DB, max: 3 });
  return pool;
}

export async function q<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db().query(sql, params);
  return r.rows as T[];
}

export async function one<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(sql, params);
  if (rows.length !== 1) throw new Error(`Kutilgan 1 qator, topildi ${rows.length}: ${sql}`);
  return rows[0]!;
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}

export function uniqueTag(prefix = "E2E"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Sessiyalar
// ---------------------------------------------------------------------------
export interface Session {
  context: BrowserContext;
  page: Page;
  login: Login;
}

export async function loginAs(browser: Browser, login: Login, viewport = login === "operator" ? DESKTOP : PHONE): Promise<Session> {
  const context = await browser.newContext({ viewport, locale: "uz-Latn-UZ", timezoneId: "Asia/Tashkent" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel(/^Login/).fill(login);
  await page.getByLabel(/^Parol/).fill(PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  return { context, page, login };
}

export async function closeAll(...sessions: (Session | undefined)[]): Promise<void> {
  for (const s of sessions) if (s) await s.context.close().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Do'kon: «Olib keting»
// ---------------------------------------------------------------------------
export interface CreatedRequest {
  id: string;
  number: number;
}

export async function createRequestUI(
  page: Page,
  opts: { note: string; point?: RegExp; estimatedKg?: string; photo?: string },
): Promise<CreatedRequest> {
  await page.goto("/shop/new");
  await expect(page.getByRole("button", { name: "Yuborish" })).toBeVisible();
  if (opts.point) await page.getByRole("radio", { name: opts.point }).check();
  if (opts.estimatedKg) {
    await page.getByRole("radio", { name: /Tarozim bor/ }).check();
    await page.getByRole("textbox", { name: /^Taxminiy vazn/ }).fill(opts.estimatedKg);
  } else {
    await page.getByRole("radio", { name: /Tarozisiz/ }).check();
    await expect(page.getByRole("radio", { name: /O‘rta/ })).toBeChecked();
  }
  if (opts.photo) {
    await page.locator('input[type="file"]').nth(1).setInputFiles(opts.photo);
    await expect(page.getByText("✓ Rasm yuklandi")).toBeVisible();
  }
  await page.getByRole("textbox", { name: /^Izoh/ }).fill(opts.note);
  await page.getByRole("button", { name: "Yuborish" }).click();
  await page.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  const row = await one<{ number: number; note: string }>(`SELECT number, note FROM "PickupRequest" WHERE id = $1`, [id]);
  expect(row.note).toBe(opts.note);
  await expect(page.getByText(`Buyurtma №${row.number} yuborildi`)).toBeVisible();
  return { id, number: row.number };
}

// ---------------------------------------------------------------------------
// Operator: navbatdan reys tuzish
// ---------------------------------------------------------------------------
export interface QueuePick {
  number: number;
  shopName: string;
}

export async function selectInQueue(page: Page, picks: QueuePick[]): Promise<void> {
  await page.goto("/operator");
  for (const p of picks) {
    await page.getByRole("checkbox", { name: `Buyurtma №${p.number} — ${p.shopName}ni tanlash` }).check();
  }
  await expect(page.getByText(`${picks.length} ta nuqta`, { exact: true })).toBeVisible();
}

async function selectOptionByText(select: Locator, text: string): Promise<void> {
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  if (!value) throw new Error(`Variant topilmadi: ${text}`);
  await select.selectOption(value);
}

export async function fillTripBuilder(page: Page, opts: { collector: "Akmal" | "Bekzod" }): Promise<void> {
  await page.waitForURL(/\/operator\/trips\/new\?ids=/);
  await selectOptionByText(page.getByRole("combobox", { name: /^Yig‘uvchi/ }), opts.collector);
  await selectOptionByText(page.getByRole("combobox", { name: /^Xaridor/ }), "Qarshi qog‘oz");
  // Xaridor sharti va minimal partiya ko'rinadi.
  await expect(page.getByText("Sifat sharti:")).toBeVisible();
  await expect(page.getByText("Minimal partiya:")).toBeVisible();
}

export async function submitTripBuilder(page: Page): Promise<{ tripId: string; tripNumber: number }> {
  await page.getByRole("button", { name: /Reysni saqlash/ }).click();
  await page.waitForURL(/\/operator\/trips\/(?!new)[^/?]+$/, { timeout: 30_000 });
  const tripId = new URL(page.url()).pathname.split("/").pop()!;
  const t = await one<{ number: number }>(`SELECT number FROM "Trip" WHERE id = $1`, [tripId]);
  await expect(page.getByRole("heading", { level: 1, name: `Reys №${t.number}` })).toBeVisible();
  return { tripId, tripNumber: t.number };
}

export async function buildTripUI(page: Page, picks: QueuePick[], collector: "Akmal" | "Bekzod"): Promise<{ tripId: string; tripNumber: number }> {
  await selectInQueue(page, picks);
  await page.getByRole("link", { name: /Vaqt va narxlarni sozlash/ }).click();
  await fillTripBuilder(page, { collector });
  return submitTripBuilder(page);
}

export async function tripStops(tripId: string): Promise<{ id: string; requestId: string; sequence: number; status: string }[]> {
  return q(`SELECT id, "requestId", sequence, status::text AS status FROM "TripStop" WHERE "tripId" = $1 AND status <> 'REMOVED' ORDER BY sequence`, [tripId]);
}

export async function stopForRequest(tripId: string, requestId: string): Promise<string> {
  const r = await one<{ id: string }>(`SELECT id FROM "TripStop" WHERE "tripId" = $1 AND "requestId" = $2`, [tripId, requestId]);
  return r.id;
}

// ---------------------------------------------------------------------------
// Yig'uvchi: tortish
// ---------------------------------------------------------------------------
export async function fillWeighing(page: Page, gross: string, tare: string): Promise<void> {
  await page.getByRole("textbox", { name: /^Brutto/ }).fill(gross);
  await page.getByRole("textbox", { name: /^Tara/ }).fill(tare);
}

export async function weighUI(page: Page, stopId: string, gross: string, tare: string, expectNet: string, photo?: string): Promise<void> {
  await page.goto(`/collector/stops/${stopId}`);
  await fillWeighing(page, gross, tare);
  await expect(page.locator("output")).toHaveText(expectNet);
  if (photo) {
    await page.locator('input[type="file"]').nth(1).setInputFiles(photo);
    await expect(page.getByText("✓ Rasm yuklandi")).toBeVisible();
  }
  await page.getByRole("button", { name: "Tortishni saqlash" }).click();
  await expect(page.getByText(`Saqlandi: ${expectNet}`)).toBeVisible();
}

// ---------------------------------------------------------------------------
// Do'kon: tasdiq
// ---------------------------------------------------------------------------
export async function confirmUI(page: Page, requestId: string): Promise<void> {
  await page.goto(`/shop/requests/${requestId}`);
  await page.getByRole("button", { name: "Tasdiqlayman" }).click();
  // Muvaffaqiyatdan keyin sahifa yangilanadi: tasdiq qatori va holat belgisi chiqadi.
  await expect(page.getByText(/^Do‘kon tasdiqladi/)).toBeVisible();
  await expect(page.getByText("Tasdiqlandi", { exact: true }).first()).toBeVisible();
}

// ---------------------------------------------------------------------------
// Operator: qabul, xarajat, to'lov, yopish
// ---------------------------------------------------------------------------
export async function acceptanceUI(
  page: Page,
  tripId: string,
  opts: { acceptedKg: string; reference: string; discrepancyReason?: string },
): Promise<void> {
  await page.goto(`/operator/trips/${tripId}`);
  await page.getByRole("textbox", { name: /^Qabul vazni/ }).fill(opts.acceptedKg);
  if (opts.discrepancyReason) {
    await expect(page.getByText(/^Tafovut: /)).toBeVisible();
    await page.getByRole("textbox", { name: /^Tafovut sababi/ }).fill(opts.discrepancyReason);
    await page.getByRole("radio", { name: /Tafovut reys hisobiga/ }).check();
  }
  await page.getByRole("textbox", { name: /^Xaridor tasdig‘i/ }).fill(opts.reference);
  await page.getByRole("button", { name: "Qabulni saqlash" }).click();
  await expect(page.getByRole("heading", { name: "Xaridor qabuli", exact: true })).toBeVisible();
}

export async function addExpenseUI(page: Page, amount: string): Promise<void> {
  const box = page.locator("details", { has: page.locator("summary", { hasText: "Xarajat qo‘shish" }) });
  await box.locator("summary").click();
  await box.getByRole("textbox", { name: /^Summa/ }).fill(amount);
  await box.getByRole("button", { name: "Xarajatni qo‘shish" }).click();
  await expect(box.getByText("Xarajat qo‘shildi.")).toBeVisible();
}

export function obligationCard(page: Page, title: "Material uchun to‘lov" | "Do‘konga karton haqi" | "Eco Point xizmat haqi", party?: string): Locator {
  let card = page.locator("ul > li").filter({ has: page.locator("p.font-bold", { hasText: title }) });
  if (party) card = card.filter({ hasText: `→ ${party}` });
  return card;
}

export async function payUI(card: Locator, amount: string): Promise<void> {
  const box = card.locator("details");
  if (!(await box.getAttribute("open").then((v) => v !== null))) await box.locator("summary").click();
  await box.getByRole("textbox", { name: /^To‘langan summa/ }).fill(amount);
  await box.locator('button[type="submit"]').click();
  // Qisman to‘lovda xabar forma ichida; to‘liq to‘langanda forma yo‘qoladi va xabar sahifa toast’iga o‘tadi.
  await expect(card.page().getByText(/To‘lov qayd etildi\. Qoldiq:/).first()).toBeVisible();
}

export async function obligations(tripId: string): Promise<{ id: string; key: string; type: string; amount: number; paid: number }[]> {
  return q(
    `SELECT o.id, o.key, o.type::text AS type, o.amount,
            COALESCE(SUM(CASE WHEN p.kind = 'PAYMENT' THEN p.amount ELSE -p.amount END), 0)::int AS paid
       FROM "Obligation" o LEFT JOIN "Payment" p ON p."obligationId" = o.id
      WHERE o."tripId" = $1 GROUP BY o.id ORDER BY o.key`,
    [tripId],
  );
}

export async function tripStatus(tripId: string): Promise<string> {
  return (await one<{ status: string }>(`SELECT status::text AS status FROM "Trip" WHERE id = $1`, [tripId])).status;
}

export async function clickClose(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Reysni yopish" }).click();
}

// ---------------------------------------------------------------------------
// Server action'ni brauzer ichidan chaqirish (UI yashirgan amallarni server rad etishini sinash).
// ID production build manifestidan olinadi. Sessiya cookie brauzerdan avtomatik ketadi.
// ---------------------------------------------------------------------------
let manifest: Record<string, { exportedName?: string; filename?: string }> | null = null;

export function actionId(name: string, file?: string): string {
  manifest ??= (JSON.parse(readFileSync(path.join(ROOT, ".next", "server", "server-reference-manifest.json"), "utf8")) as { node: Record<string, { exportedName?: string; filename?: string }> }).node;
  const hit = Object.entries(manifest).find(([, v]) => v.exportedName === name && (!file || v.filename?.includes(file)));
  if (!hit) throw new Error(`Server action topilmadi: ${name}`);
  return hit[0];
}

export interface ActionReply {
  status: number;
  result: { ok: boolean; code?: string; error?: string; replayed?: boolean; data?: Record<string, unknown> } | null;
  raw: string;
}

/** Joriy sahifa manzilida POST (Next-Action). Natija RSC oqimidan ajratib olinadi. */
export async function callAction(page: Page, name: string, args: unknown): Promise<ActionReply> {
  const id = actionId(name);
  const reply = await page.evaluate(
    async ({ id, args }) => {
      const res = await fetch(location.pathname + location.search, {
        method: "POST",
        headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify([args]),
      });
      return { status: res.status, raw: await res.text() };
    },
    { id, args },
  );
  let result: ActionReply["result"] = null;
  for (const line of reply.raw.split("\n")) {
    const m = /^[0-9a-f]+:(\{"ok":.*)$/.exec(line);
    if (m) {
      try {
        result = JSON.parse(m[1]!);
        break;
      } catch {
        // keyingi qator
      }
    }
  }
  return { status: reply.status, result, raw: reply.raw };
}

export function todayTashkent(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function nowTimeTashkent(minusMinutes = 0): string {
  const d = new Date(Date.now() - minusMinutes * 60_000);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

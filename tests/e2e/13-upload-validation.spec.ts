// 13. Yuklama tekshiruvi: rasm bo'lmagan fayl (.png kengaytmali matn) va 5 MB dan katta haqiqiy
// rasm — UI'da o'zbekcha xato, DB'da Attachment yozuvi va omborda fayl qo'shilmaydi.
// UI 5 MB'ni oldindan rad etgani uchun server chegarasi uploadImage action'ini to'g'ridan-to'g'ri
// (multipart, Next-Action) chaqirib alohida tekshiriladi.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import {
  FIXTURE_TAROZI,
  ROOT,
  SCREENS_DIR,
  SHOP_NAME,
  actionId,
  buildTripUI,
  closeAll,
  closeDb,
  createRequestUI,
  fillWeighing,
  loginAs,
  one,
  q,
  stopForRequest,
  uniqueTag,
  type ActionReply,
  type Session,
} from "./helpers";
import { makeNoisyPng } from "./png";

test.afterAll(closeDb);

const FIX_DIR = path.join(ROOT, "tests", "e2e", "fixtures");
const FAKE_PNG = path.join(FIX_DIR, "fake-text.png");
const BIG_PNG = path.join(FIX_DIR, "big-real.png");
const STORAGE = path.join(ROOT, "storage", "test-uploads");
const MAX = 5 * 1024 * 1024;

const ERR_NOT_IMAGE = "Faqat JPEG, PNG yoki WebP rasm yuklash mumkin.";
const ERR_TOO_BIG_UI = "Rasm 5 MB dan katta. Kichikroq rasm tanlang yoki kamera sifatini pasaytiring.";
const ERR_TOO_BIG_SERVER = "Rasm hajmi 5 MB dan oshmasin.";

test.beforeAll(() => {
  if (!existsSync(FIX_DIR)) mkdirSync(FIX_DIR, { recursive: true });
  writeFileSync(FAKE_PNG, "Bu rasm emas — oddiy matn fayli, faqat kengaytmasi .png.\n".repeat(20), "utf8");
  // 1500×1300×3 ≈ 5.85 MB, siqilmaydi → haqiqiy, dekodlanadigan PNG, 5 MB dan katta.
  writeFileSync(BIG_PNG, makeNoisyPng(1500, 1300));
  expect(statSync(BIG_PNG).size).toBeGreaterThan(MAX);
  expect(statSync(BIG_PNG).size).toBeLessThan(8 * 1024 * 1024); // bodySizeLimit (8mb) ichida — server servisga yetadi
});

function storedFileCount(): number {
  if (!existsSync(STORAGE)) return 0;
  return readdirSync(STORAGE, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).length;
}

async function attachmentCount(login: string): Promise<number> {
  return (await one<{ n: number }>(`SELECT count(*)::int AS n FROM "Attachment" a JOIN "User" u ON u.id = a."uploadedById" WHERE u.login = $1`, [login])).n;
}

function parseReply(status: number, raw: string): ActionReply {
  let result: ActionReply["result"] = null;
  for (const line of raw.split("\n")) {
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
  return { status, result, raw };
}

/**
 * uploadImage(FormData) ni brauzer sessiyasi (cookie) bilan to'g'ridan-to'g'ri chaqirish.
 * React Flight encodeReply formati: FormData argumenti "_1_<maydon>" ga yoyiladi (react-server-dom: prefix + "_" + id + "_"),
 * ildiz "0" = ["$K1"] OXIRIDA bo'lishi shart. Playwright `request.post({multipart})` fayllarni oxiriga
 * o'tkazgani uchun so'rov brauzer ichidan fetch(FormData) bilan yuboriladi (React mijoz bilan bir xil tartib).
 */
async function uploadDirect(page: Page, pagePath: string, file: { name: string; mimeType: string; buffer: Buffer }, kind: string): Promise<ActionReply> {
  const reply = await page.evaluate(
    async ({ id, pagePath, name, mimeType, b64, kind }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append("_1_file", new Blob([bytes], { type: mimeType }), name);
      fd.append("_1_kind", kind);
      fd.append("0", '["$K1"]');
      const res = await fetch(pagePath, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd });
      return { status: res.status, raw: await res.text() };
    },
    { id: actionId("uploadImage"), pagePath, name: file.name, mimeType: file.mimeType, b64: file.buffer.toString("base64"), kind },
  );
  return parseReply(reply.status, reply.raw);
}

test("do‘kon «Olib keting»: matnli .png va 5 MB+ rasm rad etiladi (UI + server), Attachment qo‘shilmaydi", async ({ browser }) => {
  const tag = uniqueTag("UPL");
  let d1: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    const page = d1.page;
    const before = await attachmentCount("dokon1");
    const filesBefore = storedFileCount();

    await page.goto("/shop/new");
    await page.getByRole("radio", { name: /Nur market — Markaz/ }).check();
    const gallery = page.locator('input[type="file"]').nth(1);
    const photoBox = page.locator("fieldset", { has: page.locator("legend", { hasText: "Karton rasmi" }) });

    // (a) Rasm bo'lmagan fayl (.png kengaytma, ichi matn) — brauzer image/png deb beradi, server magic bytes bo'yicha rad etadi.
    await gallery.setInputFiles(FAKE_PNG);
    await expect(photoBox.getByText(ERR_NOT_IMAGE)).toBeVisible();
    await expect(photoBox.getByText("✓ Rasm yuklandi")).toHaveCount(0);
    await expect(photoBox.getByRole("button", { name: "Qayta yuklash" })).toBeVisible();
    await photoBox.screenshot({ path: path.join(SCREENS_DIR, "upload-fake-png-rejected-390.png") });
    expect(await attachmentCount("dokon1")).toBe(before);
    expect(storedFileCount()).toBe(filesBefore);

    // (b) 5 MB dan katta haqiqiy rasm — UI oldindan rad etadi.
    await page.getByRole("button", { name: "Rasmni olib tashlash" }).click();
    await gallery.setInputFiles(BIG_PNG);
    await expect(photoBox.getByText(ERR_TOO_BIG_UI)).toBeVisible();
    await expect(photoBox.getByText("✓ Rasm yuklandi")).toHaveCount(0);
    await photoBox.screenshot({ path: path.join(SCREENS_DIR, "upload-too-big-rejected-390.png") });
    expect(await attachmentCount("dokon1")).toBe(before);
    expect(storedFileCount()).toBe(filesBefore);

    // Rasm ixtiyoriy: xatodan keyin ham buyurtma rasmsiz yuboriladi, unga hech qanday fayl bog'lanmaydi.
    await page.getByRole("textbox", { name: /^Izoh/ }).fill(`Rasmsiz ${tag}`);
    await page.getByRole("button", { name: "Yuborish" }).click();
    await page.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
    const reqId = new URL(page.url()).pathname.split("/").pop()!;
    expect((await q(`SELECT id FROM "Attachment" WHERE "requestId" = $1`, [reqId])).length).toBe(0);
    expect(await attachmentCount("dokon1")).toBe(before);

    // --- Server chegarasi (UI chetlab o'tilsa)
    await page.goto("/shop/new");
    const big = await uploadDirect(page, "/shop/new", { name: "big-real.png", mimeType: "image/png", buffer: readFileSync(BIG_PNG) }, "REQUEST_PHOTO");
    expect(big.result, `server javobi: HTTP ${big.status} ${big.raw.slice(0, 300)}`).toEqual({ ok: false, code: "UPLOAD_INVALID", error: ERR_TOO_BIG_SERVER });
    const fake = await uploadDirect(page, "/shop/new", { name: "fake-text.png", mimeType: "image/png", buffer: readFileSync(FAKE_PNG) }, "REQUEST_PHOTO");
    expect(fake.result, `server javobi: HTTP ${fake.status} ${fake.raw.slice(0, 300)}`).toEqual({ ok: false, code: "UPLOAD_INVALID", error: ERR_NOT_IMAGE });
    expect(await attachmentCount("dokon1")).toBe(before);
    expect(storedFileCount()).toBe(filesBefore);

    // Nazorat: xuddi shu usul bilan kichik haqiqiy rasm qabul qilinadi (rad etish so'rov formatidan emasligini isbotlaydi).
    const good = await uploadDirect(page, "/shop/new", { name: "tarozi.png", mimeType: "image/png", buffer: readFileSync(FIXTURE_TAROZI) }, "REQUEST_PHOTO");
    expect(good.result, `server javobi: HTTP ${good.status} ${good.raw.slice(0, 300)}`).toMatchObject({ ok: true });
    const attId = good.result?.data?.attachmentId as string;
    const att = await one<{ mimeType: string; kind: string; requestId: string | null }>(`SELECT "mimeType", kind::text AS kind, "requestId" FROM "Attachment" WHERE id = $1`, [attId]);
    expect(att).toEqual({ mimeType: "image/png", kind: "REQUEST_PHOTO", requestId: null });
    expect(await attachmentCount("dokon1")).toBe(before + 1);
    expect(storedFileCount()).toBe(filesBefore + 1);
  } finally {
    await closeAll(d1);
  }
});

test("yig‘uvchi tarozi rasmi: matnli .png va 5 MB+ rasm rad etiladi, tortish rasmsiz saqlanadi", async ({ browser }) => {
  const tag = uniqueTag("UPLC");
  let d1: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d1 = await loginAs(browser, "dokon1");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi1");
    const r = await createRequestUI(d1.page, { note: `Tarozi rasmi ${tag}`, point: /Nur market — Markaz/ });
    const { tripId } = await buildTripUI(op.page, [{ number: r.number, shopName: SHOP_NAME.dokon1 }], "Akmal");
    const stopId = await stopForRequest(tripId, r.id);

    const before = await attachmentCount("yiguvchi1");
    const filesBefore = storedFileCount();
    const page = col.page;
    await page.goto(`/collector/stops/${stopId}`);
    const gallery = page.locator('input[type="file"]').nth(1);
    const photoBox = page.locator("fieldset", { has: page.locator("legend", { hasText: "Tarozi rasmi" }) });

    await gallery.setInputFiles(FAKE_PNG);
    await expect(photoBox.getByText(ERR_NOT_IMAGE)).toBeVisible();
    await expect(photoBox.getByText("✓ Rasm yuklandi")).toHaveCount(0);
    expect(await attachmentCount("yiguvchi1")).toBe(before);

    await page.getByRole("button", { name: "Rasmni olib tashlash" }).click();
    await gallery.setInputFiles(BIG_PNG);
    await expect(photoBox.getByText(ERR_TOO_BIG_UI)).toBeVisible();
    expect(await attachmentCount("yiguvchi1")).toBe(before);

    // Server chegarasi yig'uvchi sessiyasi bilan ham (SCALE_PHOTO)
    const big = await uploadDirect(page, `/collector/stops/${stopId}`, { name: "big-real.png", mimeType: "image/png", buffer: readFileSync(BIG_PNG) }, "SCALE_PHOTO");
    expect(big.result, `server javobi: HTTP ${big.status} ${big.raw.slice(0, 300)}`).toEqual({ ok: false, code: "UPLOAD_INVALID", error: ERR_TOO_BIG_SERVER });
    const fake = await uploadDirect(page, `/collector/stops/${stopId}`, { name: "fake-text.png", mimeType: "image/png", buffer: readFileSync(FAKE_PNG) }, "SCALE_PHOTO");
    expect(fake.result).toEqual({ ok: false, code: "UPLOAD_INVALID", error: ERR_NOT_IMAGE });
    expect(await attachmentCount("yiguvchi1")).toBe(before);
    expect(storedFileCount()).toBe(filesBefore);

    // Rasm xatosi tortishni bloklamaydi: rasmsiz saqlanadi, Attachment bog'lanmaydi.
    await fillWeighing(page, "40", "0");
    await page.getByRole("button", { name: "Tortishni saqlash" }).click();
    await expect(page.getByText("Saqlandi: 40 kg")).toBeVisible();
    const w = await one<{ id: string; netGrams: number }>(`SELECT id, "netGrams" FROM "Weighing" WHERE "stopId" = $1`, [stopId]);
    expect(w.netGrams).toBe(40_000);
    expect((await q(`SELECT id FROM "Attachment" WHERE "weighingId" = $1`, [w.id])).length).toBe(0);
    expect(await attachmentCount("yiguvchi1")).toBe(before);
  } finally {
    await closeAll(d1, op, col);
  }
});

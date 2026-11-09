// Server xabarlari tarjimasi: uz bayt-bayt o‘zgarmaydi, ru/en to‘liq, shablonlar raqamlarni saqlaydi.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ActionResult } from "@/server/contract";
import { CLOSE_MISSING_PARTS, FIELD_LABELS, STATIC_MESSAGES, localizeResult, translateMessage } from "@/i18n/messages";
import { MESSAGES } from "@/domain/errors";
import { CLOSE_CHECK_LABELS, CLOSE_CHECK_MISSING } from "@/domain/settlement";
import { NET_ERROR_TEXT } from "@/domain/weight";
import { formatSom } from "@/lib/format";

const ROOT = path.resolve(import.meta.dirname, "../..");
const NBSP = " ";
const TARGETS = ["ru", "en"] as const;

// ---------------------------------------------------------------------------
// Manba fayllardan foydalanuvchi xabarlarini ajratib olish
// ---------------------------------------------------------------------------
const dirFiles = (dir: string) =>
  readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `${dir}/${f}`);

const SOURCE_FILES = [
  ...dirFiles("src/server/services"),
  ...dirFiles("src/server/actions"),
  "src/domain/errors.ts",
  "src/domain/transitions.ts",
  "src/domain/settlement.ts",
  "src/domain/weight.ts",
  "src/lib/storage.ts",
];

/** Foydalanuvchiga ko‘rsatilmaydigan satrlar (log, ichki Error → INTERNAL, DB’ga yoziladigan matn). */
const NON_MESSAGES: { test: (s: string) => boolean; why: string }[] = [
  { test: (s) => s.startsWith("[ecopoint]"), why: "server logi" },
  { test: (s) => s === "use server", why: "direktiva" },
  { test: (s) => s.startsWith("Dasturiy xato:"), why: "ichki Error → INTERNAL" },
  { test: (s) => s.startsWith("SELECT "), why: "SQL" },
  { test: (s) => s === "Noto'g'ri storageKey", why: "ichki Error → INTERNAL" },
  { test: (s) => s === "xizmat haqi", why: "assertSafeInt yorlig‘i (RangeError → INTERNAL)" },
  { test: (s) => s === "Barcha bekatlar qoldirildi", why: "Trip.cancelReason — DB’ga yoziladi" },
  { test: (s) => s === "Bahs hal qilindi", why: "audit sababi — DB’ga yoziladi" },
  { test: (s) => s.startsWith("Tuzatish: ${"), why: "BuyerAcceptance.decisionNote — DB’ga yoziladi" },
];

interface Literal {
  text: string;
  template: boolean;
  file: string;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/\s.*$/, ""))
    .join("\n");
}

function extractLiterals(): Literal[] {
  const out: Literal[] = [];
  for (const file of SOURCE_FILES) {
    const src = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
    const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    for (const m of src.matchAll(re)) {
      const template = m[2] !== undefined;
      const text = (template ? m[2] : m[1]) as string;
      const visible = text.replace(/\$\{[^}]*\}/g, "");
      if (!/ /.test(visible) || !/[a-z]/.test(visible)) continue;
      if (NON_MESSAGES.some((n) => n.test(text))) continue;
      out.push({ text, template, file });
    }
  }
  return out;
}

/** Shablon ichidagi `${…}` ifodalari uchun namunaviy qiymatlar. Yangi ifoda paydo bo‘lsa — shu yerga qo‘shing. */
const ALL_MISSING = Object.values(CLOSE_CHECK_MISSING);
const PLACEHOLDER_SAMPLES: { match: (expr: string) => boolean; values: string[] }[] = [
  { match: (e) => e === "label", values: Object.keys(FIELD_LABELS) },
  { match: (e) => e === "max", values: ["120", "500"] },
  { match: (e) => e === "MIN_PASSWORD_LENGTH", values: ["10"] },
  { match: (e) => e === "MAX_DAYS_AHEAD", values: ["30"] },
  { match: (e) => e === "MAX_STOPS", values: ["30"] },
  { match: (e) => e === "formatSom(limit)", values: [formatSom(12_000), formatSom(1_500_000)] },
  { match: (e) => e === "formatSom(res.remaining)", values: [formatSom(2_000), formatSom(-5_000)] },
  { match: (e) => e.startsWith("busy.map("), values: ["12", "12, #13"] },
  { match: (e) => e === "NAMES[machine]", values: ["Buyurtma", "Reys", "Bekat", "Bahs"] },
  {
    match: (e) => e.includes("CLOSE_CHECK_MISSING"),
    values: [...ALL_MISSING, ALL_MISSING.join("; "), `${CLOSE_CHECK_MISSING.CONFIRMED}; ${CLOSE_CHECK_MISSING.DISPUTES}`],
  },
];

function expandTemplate(tpl: string): string[] {
  const parts = tpl.split(/(\$\{[^}]*\})/);
  let acc = [""];
  for (const part of parts) {
    const m = part.match(/^\$\{([^}]*)\}$/);
    if (!m) {
      acc = acc.map((a) => a + part);
      continue;
    }
    const expr = (m[1] ?? "").trim();
    const sample = PLACEHOLDER_SAMPLES.find((s) => s.match(expr));
    if (!sample) throw new Error(`Shablon ifodasi uchun namuna yo‘q: \${${expr}} — PLACEHOLDER_SAMPLES ga qo‘shing`);
    acc = acc.flatMap((a) => sample.values.map((v) => a + v));
  }
  return acc;
}

const LITERALS = extractLiterals();
const STATIC_LITERALS = [...new Set(LITERALS.filter((l) => !l.template).map((l) => l.text))];
const TEMPLATE_LITERALS = [...new Set(LITERALS.filter((l) => l.template).map((l) => l.text))];

function expectTranslated(uz: string) {
  for (const loc of TARGETS) {
    const out = translateMessage(uz, loc);
    expect(out, `${loc} tarjimasi yo‘q: «${uz}»`).not.toBe(uz);
    expect(out.trim().length).toBeGreaterThan(0);
    if (loc === "ru") expect(out, `ru matnida kirill harfi yo‘q: «${out}»`).toMatch(/[А-Яа-яЁё]/);
    // o‘zbekcha qoldiq so‘zlar tarjimaga o‘tib qolmasin
    expect(out, `${loc} tarjimasida o‘zbekcha qoldiq: «${out}»`).not.toMatch(/[‘’]|so‘m|bo‘l|kiriting|yozing|tanlang/);
  }
}

// ---------------------------------------------------------------------------
describe("translateMessage — uz", () => {
  it("o‘zbekcha matn bayt-bayt o‘zgarmaydi", () => {
    const samples = [...STATIC_LITERALS, ...TEMPLATE_LITERALS.flatMap(expandTemplate), "Noma’lum xabar", "Too small: expected string"];
    for (const s of samples) expect(translateMessage(s, "uz")).toBe(s);
  });

  it("localizeResult uz’da aynan o‘sha obyektni qaytaradi", () => {
    const err: ActionResult = { ok: false, code: "VALIDATION", error: "Sanani tanlang.", fieldErrors: { readyDate: "Sanani tanlang." } };
    const okRes: ActionResult<{ id: string }> = { ok: true, data: { id: "x" }, message: "Reys yaratildi." };
    expect(localizeResult(err, "uz")).toBe(err);
    expect(localizeResult(okRes, "uz")).toBe(okRes);
    expect(JSON.stringify(localizeResult(err, "uz"))).toBe(JSON.stringify(err));
  });
});

describe("translateMessage — to‘liqlik (manba fayllardagi barcha xabarlar)", () => {
  it("manbadan xabarlar topildi (ajratgich ishlayapti)", () => {
    expect(STATIC_LITERALS.length).toBeGreaterThan(150);
    expect(TEMPLATE_LITERALS.length).toBeGreaterThanOrEqual(15);
    expect(STATIC_LITERALS).toContain("Reys yopildi.");
  });

  it("har bir statik xabar yoki maydon nomi ru/en tarjimaga ega", () => {
    const missing = STATIC_LITERALS.filter((s) => !(s in STATIC_MESSAGES) && !(s in FIELD_LABELS));
    expect(missing, `Tarjimasiz xabarlar:\n${missing.join("\n")}`).toEqual([]);
    for (const s of STATIC_LITERALS.filter((x) => x in STATIC_MESSAGES)) expectTranslated(s);
  });

  it("har bir shablonli xabar barcha namunaviy qiymatlar bilan tarjima qilinadi", () => {
    for (const tpl of TEMPLATE_LITERALS) {
      const variants = expandTemplate(tpl);
      expect(variants.length).toBeGreaterThan(0);
      for (const v of variants) expectTranslated(v);
    }
  });

  it("zText/zOptText/zSom/parseOptionalKg maydon nomlari FIELD_LABELS’da bor", () => {
    const labels = new Set<string>();
    const patterns = [
      /\bz(?:Opt)?Text\(\s*\d+\s*,\s*"([^"]+)"\s*\)/g,
      /\bzSom\(\s*"([^"]+)"\s*\)/g,
      /\bparseOptionalKg\([^()]*?,\s*"([^"]+)"\s*\)/g,
      /\blabel\s*=\s*"([^"]+)"/g,
    ];
    for (const file of SOURCE_FILES) {
      const src = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
      for (const re of patterns) for (const m of src.matchAll(re)) if (m[1]) labels.add(m[1]);
    }
    expect(labels.size).toBeGreaterThan(15);
    const missing = [...labels].filter((l) => !(l in FIELD_LABELS));
    expect(missing, `FIELD_LABELS’da yo‘q: ${missing.join(", ")}`).toEqual([]);
  });

  it("domen konstantalari (MESSAGES, NET_ERROR_TEXT, CLOSE_CHECK_*) to‘liq qamrab olingan", () => {
    for (const s of [...Object.values(MESSAGES), ...Object.values(NET_ERROR_TEXT), ...Object.values(CLOSE_CHECK_LABELS)]) expectTranslated(s);
    for (const s of Object.values(CLOSE_CHECK_MISSING)) expect(CLOSE_MISSING_PARTS[s], s).toBeDefined();
  });
});

describe("translateMessage — shablonlar raqamlarni saqlaydi", () => {
  it("so‘m summasi tilga mos formatga o‘tadi", () => {
    const uz = `Summa qoldiqdan oshib ketdi. Ko‘pi bilan ${formatSom(12_000)} kiritish mumkin.`;
    expect(translateMessage(uz, "ru")).toBe(`Сумма превышает остаток. Можно внести не более 12${NBSP}000${NBSP}сум.`);
    expect(translateMessage(uz, "en")).toBe("The amount exceeds the remaining balance. You can enter at most 12,000 UZS.");
    const big = `Summa qoldiqdan oshib ketdi. Ko‘pi bilan ${formatSom(1_234_567)} kiritish mumkin.`;
    expect(translateMessage(big, "en")).toContain("1,234,567");
    expect(translateMessage(big, "ru")).toContain(`1${NBSP}234${NBSP}567${NBSP}сум`);
  });

  it("qoldiq (manfiy ham) saqlanadi", () => {
    expect(translateMessage(`To‘lov qayd etildi. Qoldiq: ${formatSom(2_000)}.`, "ru")).toBe(`Платёж записан. Остаток: 2${NBSP}000${NBSP}сум.`);
    expect(translateMessage(`To‘lov qayd etildi. Qoldiq: ${formatSom(-5_000)}.`, "en")).toBe("Payment recorded. Remaining: −5,000 UZS.");
    // oddiy bo‘shliq bilan yozilgan summa ham tanilsin
    expect(translateMessage("To‘lov qayd etildi. Qoldiq: 2 000 so‘m.", "en")).toBe("Payment recorded. Remaining: 2,000 UZS.");
  });

  it("buyurtma raqamlari, belgi soni va kunlar saqlanadi", () => {
    const one = "#12 buyurtma allaqachon reysga kiritilgan yoki yopilgan. Navbatni yangilang.";
    const many = "#12, #13 buyurtma allaqachon reysga kiritilgan yoki yopilgan. Navbatni yangilang.";
    expect(translateMessage(one, "ru")).toBe("Заявка #12 уже включена в рейс или закрыта. Обновите очередь.");
    expect(translateMessage(many, "en")).toBe("Requests #12, #13 are already on a trip or closed. Refresh the queue.");
    expect(translateMessage("Parol kamida 10 belgi bo‘lsin.", "en")).toBe("The password must be at least 10 characters long.");
    expect(translateMessage("Sana 30 kundan uzoq bo‘lmasin.", "ru")).toContain("30");
    expect(translateMessage("Bitta reysda ko‘pi bilan 30 bekat.", "en")).toBe("A trip can have at most 30 stops.");
    expect(translateMessage("Izoh 500 belgidan oshmasin.", "ru")).toBe("Комментарий: не более 500 символов.");
    expect(translateMessage("Matn 1000 belgidan oshmasin.", "en")).toBe("Text: at most 1000 characters.");
  });

  it("maydon nomli shablonlar", () => {
    expect(translateMessage("Xizmat haqini so‘mda kiriting.", "ru")).toBe("Сервисный сбор: укажите сумму в сумах.");
    expect(translateMessage("To‘lov summasi butun so‘m bo‘lsin.", "en")).toBe("Payment amount: enter a whole number of UZS.");
    expect(translateMessage("Sizning vazningizni kg’da kiriting, masalan 45 yoki 45,5.", "en")).toBe("Your weight: enter the weight in kg, e.g. 45 or 45.5.");
    expect(translateMessage("Qabul vazni 0 kg’dan katta bo‘lsin.", "ru")).toBe("Принятый вес: вес должен быть больше 0 кг.");
    expect(translateMessage("Yakuniy vazn juda katta. Kg’da kiritganingizni tekshiring.", "en")).toBe(
      "Final weight: the weight is too large. Check that it's entered in kg.",
    );
    // statik xabar shablondan ustun: "Xarajat summasi 0 dan katta bo‘lsin." alohida tarjimaga ega
    expect(translateMessage("Xarajat summasi 0 dan katta bo‘lsin.", "en")).toBe("The expense amount must be greater than 0.");
  });

  it("«Reysni yopib bo‘lmaydi: …» har bir qismi tarjima qilinadi", () => {
    const uz = `Reysni yopib bo‘lmaydi: ${CLOSE_CHECK_MISSING.ACCEPTANCE}; ${CLOSE_CHECK_MISSING.DISPUTES}.`;
    expect(translateMessage(uz, "ru")).toBe("Рейс нельзя закрыть: приёмка покупателя не внесена; есть неурегулированный спор.");
    expect(translateMessage(uz, "en")).toBe("The trip can't be closed: the buyer acceptance hasn't been recorded; there is an unresolved dispute.");
  });

  it("noma’lum xabar yoki noma’lum qism — o‘zbekcha qoladi (xavfsiz zaxira)", () => {
    expect(translateMessage("Mutlaqo yangi xabar.", "ru")).toBe("Mutlaqo yangi xabar.");
    expect(translateMessage("Reysni yopib bo‘lmaydi: noma’lum sabab.", "en")).toBe("Reysni yopib bo‘lmaydi: noma’lum sabab.");
    expect(translateMessage("Noma’lum maydon juda katta.", "en")).toBe("Noma’lum maydon juda katta.");
    expect(translateMessage("Too small: expected string to have >=1 characters", "ru")).toBe("Too small: expected string to have >=1 characters");
  });
});

describe("localizeResult — ru/en", () => {
  it("error, fieldErrors va message tarjima qilinadi; code, kalitlar va data o‘zgarmaydi", () => {
    const err: ActionResult = {
      ok: false,
      code: "VALIDATION",
      error: "Tafovut bor: sababini yozing.",
      fieldErrors: { discrepancyReason: "Tafovut bor: sababini yozing.", decision: "Tafovut bor: operator qarorini tanlang.", other: "unknown" },
    };
    const ru = localizeResult(err, "ru");
    expect(ru).toEqual({
      ok: false,
      code: "VALIDATION",
      error: "Есть расхождение: укажите его причину.",
      fieldErrors: { discrepancyReason: "Есть расхождение: укажите его причину.", decision: "Есть расхождение: выберите решение оператора.", other: "unknown" },
    });
    expect(err.error).toBe("Tafovut bor: sababini yozing."); // asl obyekt o‘zgarmaydi

    const okRes: ActionResult<{ paymentId: string; remaining: number }> = {
      ok: true,
      data: { paymentId: "p1", remaining: 2000 },
      message: `To‘lov qayd etildi. Qoldiq: ${formatSom(2_000)}.`,
    };
    expect(localizeResult(okRes, "en")).toEqual({ ok: true, data: { paymentId: "p1", remaining: 2000 }, message: "Payment recorded. Remaining: 2,000 UZS." });

    const replay: ActionResult<{ id: string }> = { ok: true, data: { id: "a" }, replayed: true };
    expect(localizeResult(replay, "ru")).toBe(replay);
  });
});

// Pul qoidalari — YAGONA joy. Barcha summalar butun so'mda (Int).
// Yaxlitlash qoidasi: vazn (gramm) × narx (so'm/kg) / 1000 → eng yaqin butun so'm,
// aynan 0,5 so'm bo'lsa yuqoriga (half-up). Har bir qator (bekat) alohida yaxlitlanadi,
// jami — yaxlitlangan qatorlar yig'indisi.

export function assertSafeInt(n: number, label = "qiymat"): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${label} butun son emas: ${n}`);
}

/** gramm × so'm/kg → butun so'm (half-up). Manfiy vazn yoki narx qabul qilinmaydi. */
export function amountForWeight(grams: number, pricePerKg: number): number {
  assertSafeInt(grams, "vazn");
  assertSafeInt(pricePerKg, "narx");
  if (grams < 0 || pricePerKg < 0) throw new RangeError("Vazn va narx manfiy bo‘lmaydi");
  const milli = grams * pricePerKg; // so'm × 1000
  assertSafeInt(milli, "oraliq summa");
  return Math.floor((milli + 500) / 1000);
}

/** "12 500", "12500", "12 500 so'm" → 12500. Noto'g'ri bo'lsa null. */
export function parseSom(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isSafeInteger(input) && input >= 0 ? input : null;
  const cleaned = input.replace(/so['‘’`]?m/gi, "").replace(/[\s  ]/g, "");
  if (!/^\d{1,12}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

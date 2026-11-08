// Vazn qoidalari: ichkarida gramm (Int). Foydalanuvchi kg kiritadi: "12,5" yoki "12.5".

export const MAX_STOP_GRAMS = 5_000_000; // 5 tonna — bitta bekat uchun yuqori chegara

/** "12,5" | "12.5" | "12" → gramm. Ko'pi bilan 3 kasr xonasi. Noto'g'ri bo'lsa null. */
export function parseKgToGrams(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const grams = Number(whole) * 1000 + Number((frac + "000").slice(0, 3));
  return Number.isSafeInteger(grams) ? grams : null;
}

export type NetWeightResult =
  | { ok: true; netGrams: number }
  | { ok: false; error: "GROSS_REQUIRED" | "TARE_NEGATIVE" | "TARE_EXCEEDS_GROSS" | "GROSS_TOO_LARGE" | "NET_ZERO" };

/** Sof vazn = brutto − tara. Manfiy/ortiqcha tara rad etiladi. */
export function computeNet(grossGrams: number | null, tareGrams: number | null): NetWeightResult {
  if (grossGrams === null || grossGrams <= 0) return { ok: false, error: "GROSS_REQUIRED" };
  if (grossGrams > MAX_STOP_GRAMS) return { ok: false, error: "GROSS_TOO_LARGE" };
  const tare = tareGrams ?? 0;
  if (tare < 0) return { ok: false, error: "TARE_NEGATIVE" };
  if (tare > grossGrams) return { ok: false, error: "TARE_EXCEEDS_GROSS" };
  if (tare === grossGrams) return { ok: false, error: "NET_ZERO" };
  return { ok: true, netGrams: grossGrams - tare };
}

export const NET_ERROR_TEXT: Record<Exclude<NetWeightResult, { ok: true }>["error"], string> = {
  GROSS_REQUIRED: "Brutto vaznni kiriting (kg).",
  TARE_NEGATIVE: "Tara manfiy bo‘lishi mumkin emas.",
  TARE_EXCEEDS_GROSS: "Tara bruttodan katta bo‘lishi mumkin emas.",
  GROSS_TOO_LARGE: "Brutto juda katta. Kg’da kiritganingizni tekshiring.",
  NET_ZERO: "Sof vazn 0 kg chiqdi. Brutto va tarani tekshiring.",
};

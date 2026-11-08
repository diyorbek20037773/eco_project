import { describe, expect, it } from "vitest";
import { computeNet, MAX_STOP_GRAMS, parseKgToGrams } from "@/domain/weight";

describe("parseKgToGrams", () => {
  it("vergul va nuqtani qabul qiladi", () => {
    expect(parseKgToGrams("12,5")).toBe(12_500);
    expect(parseKgToGrams("12.5")).toBe(12_500);
    expect(parseKgToGrams("180")).toBe(180_000);
    expect(parseKgToGrams(" 162,5 ")).toBe(162_500);
    expect(parseKgToGrams("0,001")).toBe(1);
    expect(parseKgToGrams("1 234,5")).toBe(1_234_500);
  });
  it("noto‘g‘ri kiritishni rad etadi", () => {
    expect(parseKgToGrams("")).toBeNull();
    expect(parseKgToGrams("-5")).toBeNull();
    expect(parseKgToGrams("1,2345")).toBeNull();
    expect(parseKgToGrams("abc")).toBeNull();
    expect(parseKgToGrams("1e3")).toBeNull();
    expect(parseKgToGrams(null)).toBeNull();
  });
});

describe("computeNet — sof = brutto − tara", () => {
  it("oddiy holat", () => {
    expect(computeNet(185_000, 5_000)).toEqual({ ok: true, netGrams: 180_000 });
    expect(computeNet(160_000, null)).toEqual({ ok: true, netGrams: 160_000 });
    expect(computeNet(160_000, 0)).toEqual({ ok: true, netGrams: 160_000 });
  });
  it("ortiqcha tara, manfiy tara, nol sof, bo‘sh brutto rad etiladi", () => {
    expect(computeNet(10_000, 12_000)).toEqual({ ok: false, error: "TARE_EXCEEDS_GROSS" });
    expect(computeNet(10_000, -1)).toEqual({ ok: false, error: "TARE_NEGATIVE" });
    expect(computeNet(10_000, 10_000)).toEqual({ ok: false, error: "NET_ZERO" });
    expect(computeNet(null, 0)).toEqual({ ok: false, error: "GROSS_REQUIRED" });
    expect(computeNet(0, 0)).toEqual({ ok: false, error: "GROSS_REQUIRED" });
    expect(computeNet(MAX_STOP_GRAMS + 1, 0)).toEqual({ ok: false, error: "GROSS_TOO_LARGE" });
  });
});

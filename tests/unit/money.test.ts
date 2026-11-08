import { describe, expect, it } from "vitest";
import { amountForWeight, parseSom } from "@/domain/money";

describe("amountForWeight — yagona yaxlitlash qoidasi (half-up, butun so‘m)", () => {
  it("majburiy misollar", () => {
    expect(amountForWeight(1_234, 1_500)).toBe(1_851); // 1 851,0
    expect(amountForWeight(333, 1_500)).toBe(500); // 499,5 → 500
    expect(amountForWeight(180_000, 800)).toBe(144_000);
    expect(amountForWeight(160_000, 800)).toBe(128_000);
    expect(amountForWeight(470_000, 1_500)).toBe(705_000);
    expect(amountForWeight(500_000, 1_500)).toBe(750_000);
  });

  it("0,5 chegarasi: aynan yarim — yuqoriga, undan kam — pastga", () => {
    expect(amountForWeight(1, 500)).toBe(1); // 0,5 → 1
    expect(amountForWeight(1, 499)).toBe(0); // 0,499 → 0
    expect(amountForWeight(3, 500)).toBe(2); // 1,5 → 2
    expect(amountForWeight(999, 1)).toBe(1); // 0,999 → 1
    expect(amountForWeight(499, 1)).toBe(0); // 0,499 → 0
    expect(amountForWeight(500, 1)).toBe(1); // 0,5 → 1
  });

  it("0 vazn yoki 0 narx → 0", () => {
    expect(amountForWeight(0, 1_500)).toBe(0);
    expect(amountForWeight(12_345, 0)).toBe(0);
  });

  it("manfiy, kasr va xavfsiz bo‘lmagan sonlarni rad etadi", () => {
    expect(() => amountForWeight(-1, 800)).toThrow(RangeError);
    expect(() => amountForWeight(1, -800)).toThrow(RangeError);
    expect(() => amountForWeight(1.5, 800)).toThrow(RangeError);
    expect(() => amountForWeight(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });

  it("qatorlar alohida yaxlitlanadi, jami — yaxlitlangan qatorlar yig‘indisi", () => {
    const rows = [333, 333, 334].map((g) => amountForWeight(g, 1_500)); // 499,5 + 499,5 + 501
    expect(rows).toEqual([500, 500, 501]);
    expect(rows.reduce((a, b) => a + b, 0)).toBe(1_501);
    expect(amountForWeight(1_000, 1_500)).toBe(1_500); // umumiy vazndan hisoblash boshqacha bo'lardi
  });
});

describe("parseSom", () => {
  it("bo‘shliq va so‘m yozuvini tozalaydi", () => {
    expect(parseSom("12 500")).toBe(12_500);
    expect(parseSom("705 000 so‘m")).toBe(705_000);
    expect(parseSom(3000)).toBe(3000);
  });
  it("noto‘g‘ri qiymat → null", () => {
    expect(parseSom("12,5")).toBeNull();
    expect(parseSom("-5")).toBeNull();
    expect(parseSom(1.5)).toBeNull();
    expect(parseSom("")).toBeNull();
    expect(parseSom(null)).toBeNull();
  });
});

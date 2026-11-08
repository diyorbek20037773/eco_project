import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSessionSecret } from "@/lib/auth/secret";
import { sessionIdFromToken, newSessionToken } from "@/lib/auth/tokens";
import { detectImageMime, validateImage, MAX_UPLOAD_BYTES } from "@/lib/storage";

describe("parol xeshi (scrypt)", () => {
  it("format va tekshiruv", async () => {
    const h = await hashPassword("EcoDemo2026!");
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(await verifyPassword("EcoDemo2026!", h)).toBe(true);
    expect(await verifyPassword("ecodemo2026!", h)).toBe(false);
    expect(await verifyPassword("EcoDemo2026!", "plain-text")).toBe(false);
    const h2 = await hashPassword("EcoDemo2026!");
    expect(h2).not.toBe(h); // tasodifiy salt
  });
});

describe("sessiya tokeni", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("DB'da token emas, HMAC saqlanadi", () => {
    const t = newSessionToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    const id = sessionIdFromToken(t);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain(t);
    expect(sessionIdFromToken(t)).toBe(id);
  });

  it("production'da zaif yoki standart SESSION_SECRET rad etiladi", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "change-me-to-a-long-random-string-at-least-32-chars");
    expect(() => getSessionSecret()).toThrow();
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => getSessionSecret()).toThrow();
    vi.stubEnv("SESSION_SECRET", "k8Jd2nQx9Lm4Vp7Rs1Tz6Wy3Ab5Ce0Fg-unique");
    expect(getSessionSecret()).toBe("k8Jd2nQx9Lm4Vp7Rs1Tz6Wy3Ab5Ce0Fg-unique");
  });
});

describe("rasm turi (magic bytes)", () => {
  it("JPEG/PNG/WebP aniqlanadi, boshqalar rad", () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(detectImageMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageMime(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
  it("hajm chegarasi", () => {
    expect(validateImage(new Uint8Array())).toEqual({ ok: false, reason: "EMPTY" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateImage(big)).toEqual({ ok: false, reason: "TOO_LARGE" });
  });
});

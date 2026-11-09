// scripts/create-user.mjs (production obrazidagi CLI) yaratgan parol xeshini ilova tekshira olishi kerak.
import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
// @ts-expect-error — oddiy JS skript (turlar yo'q)
import { hashPassword } from "../../scripts/create-user.mjs";

describe("scripts/create-user.mjs parol xeshi", () => {
  it("ilovadagi verifyPassword bilan mos", async () => {
    const hash: string = await hashPassword("pilot-parol-2026!");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    await expect(verifyPassword("pilot-parol-2026!", hash)).resolves.toBe(true);
    await expect(verifyPassword("boshqa-parol-0000", hash)).resolves.toBe(false);
  });
});

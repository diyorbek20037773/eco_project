// 17. Muvaffaqiyat bildirishnomasi: do'kon «Tasdiqlayman» bosgach tasdiq kartasi refresh'dan keyin
// ekrandan yo'qoladi, natija matni sahifa pastidagi toast'da (role=status) ko'rinadi.
// Ikki joyda: do'kon bosh sahifasi (/shop) va buyurtma sahifasi (/shop/requests/<id>).
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
  weighUI,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

const TOAST_TEXT = "Vazn tasdiqlandi. Rahmat!";

function toast(page: Page) {
  return page.getByRole("status").filter({ hasText: TOAST_TEXT });
}

async function confirmation(stopId: string): Promise<string | null> {
  const rows = await q<{ status: string }>(`SELECT status::text AS status FROM "ShopConfirmation" WHERE "stopId" = $1`, [stopId]);
  return rows[0]?.status ?? null;
}

test("vazn tasdig‘i: karta yo‘qoladi, toast (role=status) natijani ko‘rsatadi", async ({ browser }) => {
  const tag = uniqueTag("TOAST");
  let d3: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    d3 = await loginAs(browser, "dokon3");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi2");

    const r1 = await createRequestUI(d3.page, { note: `Toast 1 ${tag}` });
    const r2 = await createRequestUI(d3.page, { note: `Toast 2 ${tag}` });
    const { tripId } = await buildTripUI(
      op.page,
      [
        { number: r1.number, shopName: SHOP_NAME.dokon3 },
        { number: r2.number, shopName: SHOP_NAME.dokon3 },
      ],
      "Bekzod",
    );
    const s1 = await stopForRequest(tripId, r1.id);
    const s2 = await stopForRequest(tripId, r2.id);
    await weighUI(col.page, s1, "52", "2", "50 kg");
    await weighUI(col.page, s2, "31", "1", "30 kg");

    // --- 1) Bosh sahifa: «Vaznni tasdiqlang» kartasi
    const page = d3.page;
    await page.goto("/shop");
    const card = page.locator("li").filter({ hasText: `Buyurtma №${r1.number} ·` }).filter({ has: page.getByRole("button", { name: "Tasdiqlayman" }) });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("50 kg");
    await expect(toast(page)).toHaveCount(0);
    await card.getByRole("button", { name: "Tasdiqlayman" }).click();
    // Natija toast'da (karta refresh'dan keyin yo'qoladi)
    await expect(toast(page)).toBeVisible();
    await expect(page.locator("li").filter({ hasText: `Buyurtma №${r1.number} ·` }).getByRole("button", { name: "Tasdiqlayman" })).toHaveCount(0);
    await expect(toast(page)).toBeVisible();
    await page.screenshot({ path: path.join(SCREENS_DIR, "shop-confirm-toast-390.png") });
    expect(await confirmation(s1)).toBe("CONFIRMED");
    expect((await one<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = $1`, [r1.id])).status).toBe("CONFIRMED");
    // Toast yopiladi
    await toast(page).getByRole("button", { name: "Xabarni yopish" }).click();
    await expect(toast(page)).toHaveCount(0);

    // --- 2) Buyurtma sahifasi
    await page.goto(`/shop/requests/${r2.id}`);
    await expect(page.getByText("Vazn to‘g‘rimi?")).toBeVisible();
    await page.getByRole("button", { name: "Tasdiqlayman" }).click();
    await expect(toast(page)).toBeVisible();
    await expect(page.getByText("Vazn to‘g‘rimi?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tasdiqlayman" })).toHaveCount(0);
    await expect(page.getByText(/^Do‘kon tasdiqladi/)).toBeVisible();
    await expect(toast(page)).toBeVisible();
    expect(await confirmation(s2)).toBe("CONFIRMED");
  } finally {
    await closeAll(d3, op, col);
  }
});

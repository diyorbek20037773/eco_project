// 11. Operator katalogda yangi do'kon (nuqta + xodim akkaunti), yig'uvchi va xaridor qo'shadi;
// yangi akkauntlar haqiqatda tizimga kira oladi, yangi do'kon «Olib keting» yubora oladi.
import { test, expect } from "@playwright/test";
import { DESKTOP, PHONE, closeAll, closeDb, loginAs, one, uniqueTag, type Session } from "./helpers";

test.afterAll(closeDb);

test("katalog: operator yangi do‘kon, yig‘uvchi va xaridor qo‘shadi; yangi akkauntlar ishlaydi", async ({ browser }) => {
  const tag = uniqueTag("DIR").toLowerCase();
  const short = tag.replace(/[^a-z0-9]/g, "").slice(-8);
  let op: Session | undefined;
  const extra: Session[] = [];
  try {
    op = await loginAs(browser, "operator", DESKTOP);
    const p = op.page;
    await p.goto("/operator/directory");

    // Do'kon + nuqta + xodim
    const shopBox = p.locator("details", { has: p.locator("summary", { hasText: "+ Yangi do‘kon qo‘shish" }) });
    await shopBox.locator("summary").click();
    await shopBox.getByRole("textbox", { name: /^Do‘kon nomi/ }).fill(`Yangi do‘kon ${short}`);
    await shopBox.getByRole("textbox", { name: /^Nuqta nomi/ }).fill(`Filial ${short}`);
    await shopBox.getByRole("textbox", { name: /^Manzil/ }).fill("Test ko‘chasi 1 (shartli)");
    await shopBox.getByRole("combobox", { name: /^Hudud/ }).or(shopBox.getByRole("textbox", { name: /^Hudud/ })).fill("Markaz");
    await shopBox.getByRole("textbox", { name: /^Nuqta telefoni/ }).fill("+998 90 111 22 33");
    const userToggle = shopBox.getByRole("checkbox", { name: /akkaunt yaratish/ });
    if (!(await userToggle.isChecked())) await userToggle.check();
    await shopBox.getByRole("textbox", { name: /^Login/ }).fill(`d${short}`);
    await shopBox.getByRole("textbox", { name: /^Xodim ismi/ }).fill("Test xodim");
    await shopBox.getByRole("textbox", { name: /^Boshlang‘ich parol/ }).fill("Parol-12345");
    await shopBox.locator('button[type="submit"]').click();
    await expect(shopBox.getByText("Do‘kon qo‘shildi.")).toBeVisible();
    const shop = await one<{ id: string; points: number; users: number }>(
      `SELECT s.id, (SELECT count(*)::int FROM "Point" pt WHERE pt."shopId" = s.id) AS points, (SELECT count(*)::int FROM "User" u WHERE u."shopId" = s.id) AS users FROM "Shop" s WHERE s.name = $1`,
      [`Yangi do‘kon ${short}`],
    );
    expect(shop).toMatchObject({ points: 1, users: 1 });

    // Yig'uvchi
    const colBox = p.locator("details", { has: p.locator("summary", { hasText: "+ Yangi yig‘uvchi qo‘shish" }) });
    await colBox.locator("summary").click();
    await colBox.getByRole("textbox", { name: /^Ism/ }).fill(`Yig‘uvchi ${short}`);
    await colBox.getByRole("textbox", { name: /^Telefon/ }).fill("+998 90 222 33 44");
    await colBox.getByRole("textbox", { name: /^Login/ }).fill(`y${short}`);
    await colBox.getByRole("textbox", { name: /^Boshlang‘ich parol/ }).fill("Parol-12345");
    await colBox.getByRole("button", { name: "Yig‘uvchini qo‘shish" }).click();
    await expect(colBox.getByText("Yig‘uvchi qo‘shildi.")).toBeVisible();

    // Xaridor
    const buyerBox = p.locator("details", { has: p.locator("summary", { hasText: "+ Yangi xaridor qo‘shish" }) });
    await buyerBox.locator("summary").click();
    await buyerBox.getByRole("textbox", { name: /^Xaridor nomi/ }).fill(`Xaridor ${short} (shartli)`);
    await buyerBox.getByRole("textbox", { name: /^Minimal partiya/ }).fill("250");
    await buyerBox.getByRole("textbox", { name: /^Sifat sharti/ }).fill("Quruq karton (shartli)");
    await buyerBox.getByRole("button", { name: "Xaridorni qo‘shish" }).click();
    await expect(buyerBox.getByText("Xaridor qo‘shildi.")).toBeVisible();
    const buyer = await one<{ minBatchGrams: number }>(`SELECT "minBatchGrams" FROM "Buyer" WHERE name = $1`, [`Xaridor ${short} (shartli)`]);
    expect(buyer.minBatchGrams).toBe(250_000);

    // Parollar xeshlangan, ochiq saqlanmaydi
    const u = await one<{ passwordHash: string; isDemo: boolean }>(`SELECT "passwordHash", "isDemo" FROM "User" WHERE login = $1`, [`y${short}`]);
    expect(u.passwordHash).not.toContain("Parol-12345");
    expect(u.isDemo).toBe(false);

    // Yangi akkauntlar bilan kirish
    for (const [login, home] of [[`d${short}`, "/shop"], [`y${short}`, "/collector"]] as const) {
      const ctx = await browser.newContext({ viewport: PHONE });
      const pg = await ctx.newPage();
      await pg.goto("/login");
      await pg.getByLabel(/^Login/).fill(login);
      await pg.getByLabel(/^Parol/).fill("Parol-12345");
      await pg.getByRole("button", { name: "Kirish" }).click();
      await pg.waitForURL(new RegExp(`${home}$`));
      extra.push({ context: ctx, page: pg, login: "operator" });
    }
    // Yangi do'kon xodimi buyurtma yubora oladi
    const sp = extra[0]!.page;
    await sp.goto("/shop/new");
    await expect(sp.getByText(`Filial ${short}`)).toBeVisible();
    await sp.getByRole("textbox", { name: /^Izoh/ }).fill(`Yangi do‘kon buyurtmasi ${tag}`);
    await sp.getByRole("button", { name: "Yuborish" }).click();
    await sp.waitForURL(/\/shop\/requests\/[^/?]+\?created=1/);
    const r = await one<{ shopId: string }>(`SELECT "shopId" FROM "PickupRequest" WHERE note = $1`, [`Yangi do‘kon buyurtmasi ${tag}`]);
    expect(r.shopId).toBe(shop.id);
  } finally {
    await closeAll(op, ...extra);
  }
});

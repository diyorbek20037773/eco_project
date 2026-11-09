// 18. Uch tillilik: ru/en tilida login (server xatosi tarjimasi bilan), uch rolning asosiy ekranlari,
// til almashtirgich cookie'ni saqlaydi, uz standart o'zgarmaydi.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { DESKTOP, PASSWORD, PHONE } from "./helpers";

const BASE = "http://localhost:3100";

const T = {
  ru: {
    loginTitle: "Вход в систему",
    submit: "Войти",
    wrongPassword: "Неверный логин или пароль.",
    shopCta: "Заберите",
    collectorTitle: "Рейс на сегодня",
    queueTitle: "Очередь заказов",
    tripsTitle: "Рейсы",
    team: "Команда проекта",
  },
  en: {
    loginTitle: "Sign in",
    submit: "Sign in",
    wrongPassword: "Incorrect login or password.",
    shopCta: "Request pickup",
    collectorTitle: "Today’s trip",
    queueTitle: "Order queue",
    tripsTitle: "Trips",
    team: "Project team",
  },
} as const;

async function open(browser: Browser, lang: "uz" | "ru" | "en", viewport = PHONE): Promise<Page> {
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: "ep_lang", value: lang, url: BASE }]);
  return context.newPage();
}

async function loginAs(page: Page, login: string, submit: string): Promise<void> {
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(login);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: submit, exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw, "gorizontal scroll").toBeLessThanOrEqual(iw);
}

for (const lang of ["ru", "en"] as const) {
  const t = T[lang];

  test(`${lang}: login, server xatosi tarjimasi va jamoa kartasi`, async ({ browser }) => {
    const page = await open(browser, lang);
    try {
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.loginTitle);
      await expect(page.getByRole("heading", { name: t.team })).toBeVisible();
      await page.locator('input[name="login"]').fill("dokon1");
      await page.locator('input[name="password"]').fill("noto-g-ri-parol");
      await page.getByRole("button", { name: t.submit, exact: true }).click();
      // Xabar serverdan o‘zbekcha keladi va server action qatlamida tarjima qilinadi.
      await expect(page.getByText(t.wrongPassword)).toBeVisible();
      await noHorizontalScroll(page);
    } finally {
      await page.context().close();
    }
  });

  test(`${lang}: do‘kon, yig‘uvchi va operator asosiy ekranlari`, async ({ browser }) => {
    const shop = await open(browser, lang);
    const col = await open(browser, lang);
    const op = await open(browser, lang, DESKTOP);
    try {
      await loginAs(shop, "dokon1", t.submit);
      await expect(shop.getByRole("link", { name: t.shopCta }).first()).toBeVisible();
      await noHorizontalScroll(shop);

      await loginAs(col, "yiguvchi1", t.submit);
      await expect(col.getByRole("heading", { level: 1 })).toHaveText(t.collectorTitle);
      await noHorizontalScroll(col);

      await loginAs(op, "operator", t.submit);
      await expect(op.getByRole("heading", { level: 1 })).toHaveText(t.queueTitle);
      await op.goto("/operator/trips");
      await expect(op).toHaveTitle(new RegExp(`^${t.tripsTitle}`));
      await noHorizontalScroll(op);
    } finally {
      for (const p of [shop, col, op]) await p.context().close();
    }
  });
}

test("til almashtirgich cookie’ni saqlaydi; standart — o‘zbekcha", async ({ browser }) => {
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();
  try {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tizimga kirish");
    await page.getByRole("button", { name: "Русский" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(T.ru.loginTitle);
    expect((await context.cookies()).find((c) => c.name === "ep_lang")?.value).toBe("ru");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(T.ru.loginTitle);
    await page.getByRole("button", { name: "O‘zbekcha" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tizimga kirish");
  } finally {
    await context.close();
  }
});

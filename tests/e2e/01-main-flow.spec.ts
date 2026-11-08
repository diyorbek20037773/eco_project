// 1. Asosiy oqim — uchta alohida sessiya (do'kon, operator, yig'uvchi) + ikkinchi do'kon:
// «Olib keting» → navbatdan reys → tortish (rasm bilan) → tasdiq → xaridor qabuli (tafovut) →
// xarajat → qisman to'lov → «To‘lov kutilmoqda» → to'liq to'lov → «Yopildi». DB tekshiruvi bilan.
import { test, expect } from "@playwright/test";
import {
  FIXTURE_KARTON,
  FIXTURE_TAROZI,
  SHOP_NAME,
  acceptanceUI,
  addExpenseUI,
  buildTripUI,
  clickClose,
  closeAll,
  closeDb,
  confirmUI,
  createRequestUI,
  loginAs,
  obligationCard,
  obligations,
  one,
  payUI,
  q,
  stopForRequest,
  tripStatus,
  uniqueTag,
  weighUI,
  type Session,
} from "./helpers";

test.afterAll(closeDb);

test("asosiy oqim: buyurtma → reys → tortish → tasdiq → qabul → qisman/to‘liq to‘lov → yopish", async ({ browser }) => {
  const tag = uniqueTag("MAIN");
  let shop: Session | undefined, shop2: Session | undefined, op: Session | undefined, col: Session | undefined;
  try {
    shop = await loginAs(browser, "dokon1");
    op = await loginAs(browser, "operator");
    col = await loginAs(browser, "yiguvchi1");
    shop2 = await loginAs(browser, "dokon2");

    // --- 1. Do'kon: bosh sahifa → «Olib keting» (tarozisiz, rasm, izoh)
    await expect(shop.page).toHaveURL(/\/shop$/);
    await expect(shop.page.getByRole("heading", { name: /Keyingi olib ketish/ })).toBeVisible();
    await expect(shop.page.getByRole("heading", { name: "Oxirgi topshirish" })).toBeVisible();
    await shop.page.getByRole("link", { name: "Olib keting" }).click();
    await expect(shop.page).toHaveURL(/\/shop\/new$/);
    const req = await createRequestUI(shop.page, { note: `Orqa eshik ${tag}`, point: /Nur market — Markaz/, photo: FIXTURE_KARTON });
    const reqRow = await one<{ status: string; volume: string | null; estimatedGrams: number | null; photos: number }>(
      `SELECT r.status::text AS status, r.volume::text AS volume, r."estimatedGrams", (SELECT count(*)::int FROM "Attachment" a WHERE a."requestId" = r.id) AS photos
         FROM "PickupRequest" r WHERE r.id = $1`,
      [req.id],
    );
    expect(reqRow).toEqual({ status: "NEW", volume: "MEDIUM", estimatedGrams: null, photos: 1 });

    // Boshqa ochiq buyurtma: dokon2 ning seed buyurtmasi (bugun, 30 kg)
    const other = await one<{ id: string; number: number }>(
      `SELECT r.id, r.number FROM "PickupRequest" r WHERE r."shopId" = 'seed-shop-bahor' AND r.status = 'NEW' AND r."clientKey" LIKE 'seed-today-%' ORDER BY r.number LIMIT 1`,
    );

    // --- 2. Operator: navbatda yangi buyurtma ko'rinadi, ikkitasini tanlab reys tuzadi
    await op.page.goto("/operator");
    await expect(op.page.getByText(`Orqa eshik ${tag}`).filter({ visible: true })).toBeVisible();
    const { tripId, tripNumber } = await buildTripUI(
      op.page,
      [
        { number: req.number, shopName: SHOP_NAME.dokon1 },
        { number: other.number, shopName: SHOP_NAME.dokon2 },
      ],
      "Akmal",
    );
    expect(await tripStatus(tripId)).toBe("PLANNED");
    const priceSnap = await one<{ shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number }>(
      `SELECT "shopPricePerKg", "buyerPricePerKg", "serviceFee" FROM "Trip" WHERE id = $1`,
      [tripId],
    );
    expect(priceSnap).toEqual({ shopPricePerKg: 800, buyerPricePerKg: 1500, serviceFee: 3000 });
    const stop1 = await stopForRequest(tripId, req.id);
    const stop2 = await stopForRequest(tripId, other.id);

    // Do'kon keyingi olib ketish vaqtini va yig'uvchini ko'radi
    await shop.page.goto("/shop");
    await expect(shop.page.getByText(`Buyurtma №${req.number}`).first()).toBeVisible();
    await expect(shop.page.getByText("Yig‘uvchi:").first()).toBeVisible();

    // --- 3. Yig'uvchi: «Bugungi reys» — manzil, kontakt, qo'ng'iroq, keyingi nuqta
    await col.page.goto("/collector");
    await expect(col.page.getByRole("link", { name: new RegExp(`Reys №${tripNumber}`) })).toBeVisible();
    await expect(col.page.getByText("I. Karimov ko‘chasi 12 (shartli)").first()).toBeVisible();
    const call = col.page.getByRole("link", { name: "Qo‘ng‘iroq qilish" }).first();
    await expect(call).toHaveAttribute("href", "tel:+998900000011");
    await expect(col.page.getByText(/Keyin: .*Bahor savdo/)).toBeVisible();
    await col.page.getByRole("link", { name: "Tortishni kiritish" }).click();
    await expect(col.page).toHaveURL(new RegExp(`/collector/stops/${stop1}$`));
    // Raqam klaviaturasi va kg birligi
    await expect(col.page.getByRole("textbox", { name: /^Brutto/ })).toHaveAttribute("inputmode", "decimal");
    await expect(col.page.getByText("kg", { exact: true }).first()).toBeVisible();
    // Jonli sof vazn: 47,351 − 2 = 45,351 kg (yaxlitlash sinovi uchun kasrli)
    await weighUI(col.page, stop1, "47,351", "2", "45,351 kg", FIXTURE_TAROZI);
    await col.page.getByRole("link", { name: "Keyingi nuqta" }).click();
    await expect(col.page).toHaveURL(new RegExp(`/collector/stops/${stop2}$`));
    await weighUI(col.page, stop2, "30,5", "0,5", "30 kg");
    await expect(col.page.getByText(/^Reys yakunlandi: barcha nuqtalar bajarildi/)).toBeVisible();

    const w = await q<{ stopId: string; grossGrams: number; tareGrams: number; netGrams: number; photos: number }>(
      `SELECT w."stopId", w."grossGrams", w."tareGrams", w."netGrams", (SELECT count(*)::int FROM "Attachment" a WHERE a."weighingId" = w.id) AS photos
         FROM "Weighing" w WHERE w."stopId" = ANY($1) ORDER BY w."netGrams" DESC`,
      [[stop1, stop2]],
    );
    expect(w).toEqual([
      { stopId: stop1, grossGrams: 47351, tareGrams: 2000, netGrams: 45351, photos: 1 },
      { stopId: stop2, grossGrams: 30500, tareGrams: 500, netGrams: 30000, photos: 0 },
    ]);
    expect(await tripStatus(tripId)).toBe("COLLECTED");

    // --- 4. Do'konlar o'z vaznini tasdiqlaydi
    await confirmUI(shop.page, req.id);
    await confirmUI(shop2.page, other.id);
    const reqStatuses = await q<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = ANY($1)`, [[req.id, other.id]]);
    expect(reqStatuses.map((r) => r.status)).toEqual(["CONFIRMED", "CONFIRMED"]);

    // --- 5. Operator: xaridor qabuli tafovut bilan (75,351 topshirildi → 75,001 qabul)
    await op.page.goto(`/operator/trips/${tripId}`);
    await expect(op.page.getByText("Topshirishlar yig‘indisi").first()).toBeVisible();
    await acceptanceUI(op.page, tripId, { acceptedKg: "75,001", reference: `NAK-${tag}`, discrepancyReason: `Namlik ${tag}` });
    // Topshirishlar va qabul vazni yonma-yon
    const weights = op.page.locator("#weights");
    await expect(weights.getByText("75,351 kg").first()).toBeVisible();
    await expect(weights.getByText("75,001 kg").first()).toBeVisible();
    await expect(weights.getByText("−0,35 kg").first()).toBeVisible();
    const acc = await one<{ acceptedGrams: number; deliveredGrams: number; discrepancyGrams: number; decision: string; discrepancyReason: string }>(
      `SELECT "acceptedGrams", "deliveredGrams", "discrepancyGrams", decision::text AS decision, "discrepancyReason" FROM "BuyerAcceptance" WHERE "tripId" = $1`,
      [tripId],
    );
    expect(acc).toEqual({ acceptedGrams: 75001, deliveredGrams: 75351, discrepancyGrams: -350, decision: "TRIP_ABSORBS", discrepancyReason: `Namlik ${tag}` });
    expect(await tripStatus(tripId)).toBe("ACCEPTED");

    // Xarajat
    await addExpenseUI(op.page, "20000");

    // Hisob: yaxlitlash (half-up, har bekat alohida) DB orqali
    let obs = await obligations(tripId);
    const byKey = Object.fromEntries(obs.map((o) => [o.key, o]));
    expect(byKey["BUYER_MATERIAL"]?.amount).toBe(112502); // 75,001 × 1500 = 112 501,5 → 112 502
    expect(byKey[`SHOP_PAYOUT:${stop1}`]?.amount).toBe(36281); // 45,351 × 800 = 36 280,8 → 36 281
    expect(byKey[`SHOP_PAYOUT:${stop2}`]?.amount).toBe(24000);
    expect(byKey["SERVICE_FEE"]?.amount).toBe(3000);
    expect(obs).toHaveLength(4);
    const money = op.page.locator("#money");
    await expect(money.getByText("112 502 so‘m").first()).toBeVisible();
    await expect(money.getByText("Butun reys hissasi")).toBeVisible();
    // 112 502 − 60 281 − 20 000 = 32 221
    await expect(money.locator("dl > div", { hasText: "Butun reys hissasi" })).toContainText("32 221 so‘m");
    await expect(money.locator("dl > div", { hasText: "Hamkorda qoladi" })).toContainText("29 221 so‘m");

    // --- 6. Qisman to'lov (xaridor 50 000) → qoldiq ko'rinadi
    const buyerCard = obligationCard(op.page, "Material uchun to‘lov");
    await payUI(buyerCard, "50000");
    await expect(buyerCard.getByText("To‘lov qayd etildi. Qoldiq: 62 502 so‘m.")).toBeVisible();
    await expect(buyerCard.locator("dl > div", { hasText: "Qoldiq" })).toContainText("62 502 so‘m");
    await expect(buyerCard.getByText("Qisman to‘langan")).toBeVisible();

    // --- 7. Yopish urinishi → «To‘lov kutilmoqda»
    await clickClose(op.page);
    await expect(op.page.getByText("To‘lov kutilmoqda").first()).toBeVisible();
    await expect.poll(() => tripStatus(tripId)).toBe("AWAITING_PAYMENT");

    // --- 8. Qolgan to'lovlar
    obs = await obligations(tripId);
    for (const o of obs) {
      const remaining = o.amount - o.paid;
      if (remaining <= 0) continue;
      const card =
        o.type === "BUYER_MATERIAL"
          ? obligationCard(op.page, "Material uchun to‘lov")
          : o.type === "SERVICE_FEE"
            ? obligationCard(op.page, "Eco Point xizmat haqi")
            : obligationCard(op.page, "Do‘konga karton haqi", o.key.endsWith(stop1) ? SHOP_NAME.dokon1 : SHOP_NAME.dokon2);
      await payUI(card, String(remaining));
      await expect(card.getByText("To‘lov qayd etildi. Qoldiq: 0 so‘m.")).toBeVisible();
    }
    obs = await obligations(tripId);
    for (const o of obs) expect(o.paid, o.key).toBe(o.amount);
    const payCount = await one<{ n: number; total: number }>(
      `SELECT count(*)::int AS n, COALESCE(sum(p.amount), 0)::int AS total FROM "Payment" p JOIN "Obligation" o ON o.id = p."obligationId" WHERE o."tripId" = $1`,
      [tripId],
    );
    expect(payCount).toEqual({ n: 5, total: 112502 + 36281 + 24000 + 3000 });

    // --- 9. Yopish → «Yopildi»
    await op.page.reload();
    await clickClose(op.page);
    await expect(op.page.getByText("Reys yopildi").first()).toBeVisible();
    await expect.poll(() => tripStatus(tripId)).toBe("CLOSED");
    const settled = await q<{ status: string }>(`SELECT status::text AS status FROM "PickupRequest" WHERE id = ANY($1)`, [[req.id, other.id]]);
    expect(settled.map((r) => r.status)).toEqual(["SETTLED", "SETTLED"]);
    const auditRows = await q<{ action: string }>(`SELECT action FROM "AuditEvent" WHERE "tripId" = $1`, [tripId]);
    expect(auditRows.length).toBeGreaterThanOrEqual(8);

    // --- 10. Do'kon kvitansiyasi: vazn, narx, summa, to'lov holati
    await shop.page.goto(`/shop/requests/${req.id}`);
    const receipt = shop.page.locator("#receipt");
    await expect(receipt.getByText("45,351 kg")).toBeVisible();
    await expect(receipt.getByText("800 so‘m/kg")).toBeVisible();
    await expect(receipt.getByText("36 281 so‘m").first()).toBeVisible();
    await expect(receipt.getByText("To‘langan").first()).toBeVisible();
    await expect(receipt.locator("dl > div", { hasText: "Qoldiq" })).toContainText("0 so‘m");
    await shop.page.goto("/shop/history");
    await expect(shop.page.getByText(`Buyurtma №${req.number}`).first()).toBeVisible();
  } finally {
    await closeAll(shop, shop2, op, col);
  }
});

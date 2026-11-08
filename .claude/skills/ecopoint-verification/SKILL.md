---
name: ecopoint-verification
description: Eco Point pilotini tekshirish qoidalari — qayta ishlaydigan seed, izolyatsiyalangan test DB, alohida sessiyalardagi rollararo Playwright E2E, qayta urinish/ikki marta bosish, ruxsatsiz murojaat, takroriy topshirish/to‘lov va toza o‘rnatish. Test yozish, E2E yurgizish, review yoki «tayyor» deyishdan oldin qo‘lla.
---

# ecopoint-verification

## Qachon qo‘llanadi
- `tests/e2e/**`, `tests/db/**`, `playwright.config.ts`, `prisma/seed.ts` yozilayotganda.
- Biror bosqich «tayyor» deb belgilanishidan oldin; review topilmalarini qayta tekshirishda.

## Muhit
- Ish bazasi: `DATABASE_URL` (…/ecopoint). Test bazasi: `TEST_DATABASE_URL` (…/ecopoint_test). Testlar **hech qachon** ish bazasiga yozmaydi.
- Playwright `webServer` ilovani `PORT=3100`, `DATABASE_URL=$TEST_DATABASE_URL`, `STORAGE_DIR=./storage/test-uploads` bilan ko‘taradi. `globalSetup`: `prisma migrate reset --force --skip-seed` → `tsx prisma/seed.ts` (test DB’ga).
- Lokal DB: `npm run db:local` (5433 port). Docker bo‘lsa: `docker compose up -d`.

## Amaliy qadamlar
1. **Seed idempotentligi:** seed’ni ikki marta yurgiz, so‘ng `User`, `Shop`, `Point`, `Buyer`, `Tariff`, `PickupRequest`, `Trip` sonlari o‘zgarmaganini tekshir.
2. **Rollararo E2E** — har rol uchun alohida `browser.newContext()` (alohida cookie):
   `dokon1` «Olib keting» → `operator` navbatdan tanlab reys tuzadi → `yiguvchi1` tortadi (brutto/tara, rasm) → `dokon1` tasdiqlaydi → `operator` xaridor qabuli (tafovut izohi+qaror) → xarajat → qisman to‘lov (qoldiq ko‘rinadi) → yopish urinish = «To‘lov kutilmoqda» → to‘liq to‘lov → «Yopildi».
3. **Qoldirish va qayta reja:** yig‘uvchi «Karton tayyor emas» (sabab) → operator navbatda «Qoldirildi» belgisini ko‘radi → yangi reysga kiritadi.
4. **Bahs:** do‘kon e’tiroz (sabab, kg) → operator qarori → do‘kon va yig‘uvchi rozi → bahs «Hal qilindi», yopish ruxsat etiladi; bahs ochiqligida yopish rad.
5. **Yo‘l qo‘yilmagan o‘tish:** qabulsiz yopish, PLANNED reysda qabul, qoldirilgan bekatni tortish → server xatosi, UI’da o‘zbekcha xabar.
6. **Ruxsatsiz murojaat:** `dokon2` sessiyasi bilan `dokon1` buyurtmasi `/shop/requests/<id>`, `/api/requests/<id>`, `/api/files/<id>`, `/api/trips/<id>` → 404; `yiguvchi2` bilan `yiguvchi1` bekati → 404; do‘kon `/operator` → redirect; sessiyasiz → `/login`.
7. **Takroriy topshirish va to‘lov:** bir `clientKey` bilan ikki marta `recordWeighing`/`recordPayment` → bitta yozuv; tugmani tez ikki marta bosish → bitta yozuv; ortiqcha to‘lov → rad.
8. **Tarmoq uzilishi:** `context.setOffline(true)` → forma yuborish → «Qayta yuborish» va qiymatlar saqlangan → `setOffline(false)` → muvaffaqiyat.
9. **Mobil/desktop:** 360, 390, 1440 px screenshot (`test-results/screens/*.png`), `scrollWidth <= innerWidth` assert, asosiy tugma ≥ 44 px.
10. **Toza o‘rnatish:** bo‘sh bazada README buyruqlari: `npm ci` → `npm run db:migrate` → `npm run db:seed` (2 marta) → `npm run build` → `npm run start` → `/api/health` 200.

## Loyihaga xos misol
```ts
const shop = await browser.newContext(); const op = await browser.newContext(); const col = await browser.newContext();
await login(shop, "dokon1"); await login(op, "operator"); await login(col, "yiguvchi1");
// 470 kg qabul → reys sahifasida "Reys hissasi 5 000 so‘m", "Xaridor to‘lovi 705 000 so‘m", "Do‘konlarga 400 000 so‘m"
// DB tekshiruvi: prisma.obligation.findMany({ where: { tripId } }) → BUYER_MATERIAL 705000, SHOP_PAYOUT jami 400000
```

## Tekshirish mezoni (dalil bilan qaytariladi)
- Har test nomi, natijasi (passed/failed), muvaffaqiyatsiz bo‘lsa — xato matni va screenshot yo‘li.
- Nuqson ro‘yxati: joy (fayl/ekran), takrorlash qadamlari, kutilgan va haqiqiy natija, jiddiylik.
- Tekshirilmagan narsa «o‘tdi» deb yozilmaydi; «tekshirilmadi: sabab» deb yoziladi.

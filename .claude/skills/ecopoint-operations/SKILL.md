---
name: ecopoint-operations
description: Eco Point karton pilotining operatsion va moliyaviy qoidalari — partiya (reys), ikki vazn (topshirish va xaridor qabuli), vazn bahsi, qisman to‘lov, majburiyatlar va reys hissasini hisoblash. Schema, migratsiya, server amallari, holat o‘tishlari yoki hisob-kitob kodi yozilayotganda yoki tekshirilayotganda qo‘lla.
---

# ecopoint-operations

## Qachon qo‘llanadi
- `prisma/schema.prisma`, migratsiya, `src/domain/settlement.ts`, `src/domain/transitions.ts`, `src/server/**` ni o‘zgartirayotganda.
- Reys, bekat, tortish, tasdiq/bahs, qabul, xarajat, majburiyat, to‘lov, tuzatish yoki audit bilan bog‘liq har qanday mantiqda.
- Hisob natijasi (so‘m yoki kg) noto‘g‘ri ko‘ringanda tekshiruv uchun.

## Asosiy qoidalar
1. **Birliklar.** Vazn — gramm `Int`, pul — butun so‘m `Int`, narx — so‘m/kg `Int`. Float saqlanmaydi.
2. **Yaxlitlash bitta joyda:** `src/domain/money.ts › amountForWeight(grams, pricePerKg)` — `floor((g×p + 500)/1000)`, half-up, har bekat alohida; jami = yaxlitlangan qatorlar yig‘indisi. Boshqa joyda `/1000` yoki `Math.round` yozilmaydi.
3. **Ikki vazn.** *Topshirish* (bekatdagi `Weighing.netGrams`, bahs hal bo‘lsa `Dispute.decidedNetGrams`) va *xaridor qabuli* (`BuyerAcceptance.acceptedGrams`) alohida saqlanadi va yonma-yon ko‘rsatiladi. Qabul — «qayta ishlandi» degan da’vo emas, faqat xaridor tasdig‘i asosidagi qabul vazni.
4. **Tafovut** `accepted − delivered` do‘konga avtomatik yozilmaydi. ≠ 0 bo‘lsa `discrepancyReason` va operator qarori (`decision`) majburiy; aralash partiyada do‘kon to‘lovi faqat o‘z tasdiqlangan vaznidan.
5. **Reys iqtisodi:**
   - `buyerRevenue = amountForWeight(accepted, buyerPrice)`
   - `shopPayout_i = amountForWeight(effectiveNet_i, shopPrice)`
   - `tripContribution = buyerRevenue − Σ shopPayout − Σ expenses`
   - `partnerShareAfterFee = tripContribution − serviceFee`, `ecoPointServiceIncome = serviceFee`
   - Xizmat haqi reys daromadiga ikkinchi marta qo‘shilmaydi.
6. **Hisoblangan ≠ tushgan.** `Obligation.amount` — hisoblangan; `Payment` — haqiqatda qayd etilgan. `remaining = amount − (Σ PAYMENT − Σ REFUND)`. Ortiqcha to‘lov rad etiladi (`OVERPAYMENT`); takroriy `clientKey` — avvalgi natija.
7. **Narx nusxasi.** Reys yaratilganda tarif qiymatlari `Trip.shopPricePerKg/buyerPricePerKg/serviceFee` ga ko‘chiriladi. Yangi tarif eski reysga ta’sir qilmaydi.
8. **Holat o‘tishlari** faqat serverda, `src/domain/transitions.ts` dagi ruxsat jadvali orqali; tranzaksiyada shartli `updateMany` + `count` tekshiruvi.
9. **Yopish shartlari:** barcha bekat COLLECTED/SKIPPED; har COLLECTED bekat do‘kon tomonidan tasdiqlangan yoki bahsi RESOLVED; qabul mavjud; ochiq bahs yo‘q; barcha majburiyat `remaining === 0`. Faqat to‘lov qolsa → `AWAITING_PAYMENT`.
10. **Tuzatish** (yopilgan yoki qabul qilingan reys): sabab majburiy; `AuditEvent{before, after, reason, actorId, at}`; majburiyatlar qayta hisoblanadi; qoldiq ≠ 0 → `AWAITING_PAYMENT`.

## Amaliy qadamlar
1. Avval `docs/contract.md` va `src/server/contract.ts` ni o‘qi — imzolarni o‘zgartirma (kerak bo‘lsa orkestratorga ayt).
2. Sof hisobni `settlement.ts` da yoz, DB’siz test qil (`tests/unit`).
3. Servis funksiyasi: `(actor, input) → ActionResult`. Tartib: autentifikatsiya → rol → obyekt egaligi (begona → `NOT_FOUND`) → zod → tranzaksiya → audit → natija.
4. Server action faqat servisni chaqiradi va `revalidatePath` qiladi.
5. DB testini izolyatsiyalangan `TEST_DATABASE_URL` da yurgiz (`tests/db`).

## Loyihaga xos misol (majburiy test)
```
Bekatlar: A 180 kg, B 160 kg, C 160 kg  → delivered 500 000 g
Narx: do‘kon 800, xaridor 1 500 so‘m/kg; xarajat: transport 300 000
Qabul 500 kg: revenue 750 000; shops 144 000+128 000+128 000 = 400 000; contribution 50 000
Qabul 470 kg: revenue 705 000; shops 400 000; contribution 5 000; discrepancy −30 000 g (izoh+qaror majburiy)
Xizmat haqi 3 000: partnerShareAfterFee 2 000; ecoPointServiceIncome 3 000
SERVICE_FEE to‘lovi 1 000 → remaining 2 000 → yopishda AWAITING_PAYMENT
Yaxlitlash: amountForWeight(1 234, 1 500) = 1 851 (1 851,0); amountForWeight(333, 1 500) = 500 (499,5 → 500)
```

## Tekshirish mezoni
- `npm run test:unit` — settlement (500/470, xizmat haqi, yaxlitlash chegaralari), `computeNet`, transitions.
- `npm run test:db` — 500/470 misoli DB orqali, takroriy tortish/to‘lov `clientKey`, ortiqcha to‘lov rad, ikki faol reysga bitta buyurtma rad, parallel `recordPayment`, begona do‘kon/yig‘uvchi `NOT_FOUND`, tuzatishdan keyin audit va balans.
- Hech bir joyda float pul yoki `Math.round(x/1000)` yo‘q: `grep -rn "/ 1000" src/server src/domain` faqat `money.ts`/`weight.ts`/format’da.

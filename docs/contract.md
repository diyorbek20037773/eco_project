# Eco Point pilot — umumiy kontrakt (orkestrator)

Kod turlari: `src/server/contract.ts`. Schema: `prisma/schema.prisma`. Bu hujjat qoidalarni belgilaydi.

## 1. Birliklar va yagona qoidalar
| Narsa | Saqlash | Yagona joy |
|---|---|---|
| Vazn | gramm, `Int` | `src/domain/weight.ts` (`parseKgToGrams`, `computeNet`) |
| Pul | butun so‘m, `Int` | `src/domain/money.ts` (`amountForWeight` — half-up, har bekat alohida) |
| Vaqt | UTC `DateTime`, ko‘rsatish Asia/Tashkent | `src/domain/time.ts`, `src/lib/format.ts` |
| Hisob-kitob | sof funksiya | `src/domain/settlement.ts` (operations-engineer) |

Sof vazn = brutto − tara; tara > brutto, manfiy, 0 sof — rad. DB’da CHECK constraint ham bo‘ladi.

## 2. Hisob modeli (pilot)
Material hamkor yig‘uvchiga tegishli.
- `buyerRevenue = amountForWeight(acceptedGrams, buyerPricePerKg)` — xaridor → hamkor (`BUYER_MATERIAL`).
- Har bekat: `amountForWeight(effectiveNetGrams, shopPricePerKg)` — hamkor → do‘kon (`SHOP_PAYOUT:<stopId>`).
- `expensesTotal` — transport/yuklash/boshqa xarajatlar yig‘indisi.
- `tripContribution = buyerRevenue − shopPayoutTotal − expensesTotal` — butun reys hissasi.
- `serviceFee` — hamkor → Eco Point (`SERVICE_FEE`), reys narx nusxasida. `partnerShareAfterFee = tripContribution − serviceFee`. `ecoPointServiceIncome = serviceFee`. Xizmat haqi reys iqtisodiga ikkinchi marta daromad bo‘lib qo‘shilmaydi.
- Hisoblangan (`Obligation.amount`) va haqiqatda tushgan (`Payment`) alohida. Pul tashqarida o‘tkaziladi, tizim tasdiqni qayd etadi.
- Tafovut (`accepted − delivered`) do‘konlarga avtomatik yozilmaydi: do‘kon to‘lovi uning tasdiqlangan/bahsda hal qilingan vaznidan. Tafovut ≠ 0 bo‘lsa izoh + operator qarori majburiy.
- `serviceFee = 0` bo‘lsa `SERVICE_FEE` majburiyati yaratilmaydi (yoki 0 — to‘langan hisoblanadi). Summasi 0 bo‘lgan majburiyat yaratilmaydi.

### Majburiy raqamli misol (test qilinadi)
Uch bekat 180 + 160 + 160 = 500 kg. Do‘kon narxi 800, xaridor 1 500 so‘m/kg, boshqa xarajat 300 000.
- 500 kg qabul: tushum 750 000, do‘konlar 400 000, hissa **50 000**.
- 470 kg qabul: tushum **705 000**, do‘konlar **400 000**, hissa **5 000**.
- Xizmat haqi 3 000: hamkorda **2 000**, Eco Point xizmat daromadi **3 000**; 1 000 to‘langanda qoldiq **2 000**.

## 3. Holat mashinalari (faqat server o‘tkazadi)
**Buyurtma (`RequestStatus`)**: `NEW → PLANNED` (reysga) · `PLANNED → COLLECTED` (tortildi) | `SKIPPED` (qoldirildi, sabab) · `SKIPPED → PLANNED` (qayta reja) · `COLLECTED → CONFIRMED | DISPUTED` (do‘kon) · `DISPUTED → CONFIRMED` (bahs hal) · `CONFIRMED → SETTLED` (reys yopildi) · `NEW|SKIPPED → CANCELLED` · reys bekor qilinsa / bekat olib tashlansa `PLANNED → NEW`.

**Reys (`TripStatus`)**: `PLANNED → IN_PROGRESS` (birinchi bekat amali) → `COLLECTED` (barcha bekat COLLECTED/SKIPPED, kamida bittasi olingan; hammasi qoldirilsa → `CANCELLED`) → `ACCEPTED` (xaridor qabuli, majburiyatlar yaratiladi) → `closeTrip`: shartlar (bekatlar, tasdiqlar, qabul, bahslar) bajarilsa va to‘lov qolsa → `AWAITING_PAYMENT`; hammasi to‘langan → `CLOSED`. `PLANNED → CANCELLED` (operator, sabab). Yopilgandan keyin tuzatish → audit (eski, yangi, sabab, muallif, vaqt), majburiyatlar qayta hisoblanadi; qoldiq ≠ 0 bo‘lsa → `AWAITING_PAYMENT`.

**Bekat (`StopStatus`)**: `PENDING → COLLECTED | SKIPPED`; reys tahriri/bekorida `PENDING → REMOVED`. `activeRequestKey` unique = bitta buyurtma bitta faol reysda.

**Bahs (`DisputeStatus`)**: do‘kon ochadi `OPEN` (sabab majburiy) → operator `decideDispute` (qaror matni + yakuniy kg) `DECIDED` → do‘kon VA yig‘uvchi rozi → `RESOLVED`; kimdir rozi bo‘lmasa (izoh bilan) → `OPEN`. `openKey` unique = bekatda bitta ochiq bahs. Bahs hal bo‘lganda majburiyatlar (qabul bo‘lsa) qayta hisoblanadi.

## 4. Ruxsat matritsasi (server tekshiradi; begona obyekt → 404, rol mos emas → 403/redirect)
| Amal / ma’lumot | SHOP | COLLECTOR | OPERATOR |
|---|---|---|---|
| O‘z nuqtalari, buyurtma yaratish/bekor qilish | o‘z do‘koni | — | hammasi (bekor) |
| Buyurtma/bekat/tortish/rasm ko‘rish | o‘z do‘koni | o‘z reysi | hammasi |
| Navbat, reys tuzish/tahrir/bekor | — | — | ✓ |
| Tortish kiritish, qoldirish | — | o‘z reysi, PENDING | — |
| Vaznni tasdiqlash / e’tiroz | o‘z bekati | — | — |
| Bahs qarori | — | — | ✓ |
| Bahs qaroriga rozilik | o‘z bekati | o‘z reysi | — |
| Xaridor qabuli, xarajat, to‘lov, yopish, tuzatish | — | — | ✓ |
| Reys iqtisodi | faqat o‘z to‘lovi | o‘z reysi | ✓ |
| Katalog (do‘kon, yig‘uvchi, xaridor, tarif), audit | — | — | ✓ |

## 5. Idempotentlik va parallel ishlash
- Yaratuvchi mutatsiyalarda `clientKey` (forma mount’ida `crypto.randomUUID()`), DB’da unique. Takror → avvalgi natija, `replayed: true`.
- `Weighing.stopId`, `ShopConfirmation.stopId`, `BuyerAcceptance.tripId` unique.
- Holat o‘tishi: tranzaksiya ichida `updateMany({ where: { id, status: <kutilgan> } })` va `count === 1` tekshiruvi; aks holda `CONFLICT`/`INVALID_TRANSITION`.
- To‘lov: tranzaksiyada (qator qulfi `SELECT … FOR UPDATE` yoki serializable) qoldiqni qayta hisoblab, `amount > remaining` → `OVERPAYMENT`.

## 6. Yo‘nalishlar (`src/lib/routes.ts`)
`/login` · `/` (rolga redirect) · Do‘kon: `/shop`, `/shop/new`, `/shop/requests/[id]`, `/shop/history` · Yig‘uvchi: `/collector`, `/collector/trips/[id]`, `/collector/stops/[id]` · Operator: `/operator` (navbat), `/operator/trips`, `/operator/trips/new?ids=…`, `/operator/trips/[id]`, `/operator/directory`, `/operator/audit` · API: `/api/health`, `/api/files/[id]`, `/api/requests/[id]`, `/api/trips/[id]`.

## 7. Seed (qayta ishlaydigan, upsert; production’da demo seed ishlamaydi)
Parol hammasi uchun: `EcoDemo2026!` (faqat demo, `isDemo=true`, production’da kira olmaydi).
| Login | Rol | Kim |
|---|---|---|
| `operator` | OPERATOR | Eco Point operatori |
| `dokon1` | SHOP | «Nur market» (2 nuqta) |
| `dokon2` | SHOP | «Bahor savdo» (boshqa do‘kon — izolyatsiya testi) |
| `dokon3` | SHOP | «Oila supermarketi» |
| `yiguvchi1` | COLLECTOR | Hamkor yig‘uvchi Akmal |
| `yiguvchi2` | COLLECTOR | Hamkor yig‘uvchi Bekzod |

Xaridor: «Qarshi qog‘oz qayta ishlash» (shartli), min partiya 300 kg. Tarif: 800 / 1 500 / xizmat 3 000.
Demo ma’lumot: kechagi namunaviy reys (180/160/160 → 470 kg, xarajat 300 000, xaridor to‘liq to‘lagan, do‘konlarga qisman, xizmat haqi 1 000 / 3 000) `AWAITING_PAYMENT` holatida; bugunga 3 ta `NEW` buyurtma. Hammasi deterministik `clientKey` bilan — qayta seed dublikat bermaydi. Manzillar va narxlar shartli.

## 8. Fayl egaligi (bir faylni bir vaqtda ikki agent o‘zgartirmaydi)
| Egasi | Fayllar |
|---|---|
| orkestrator | `package.json`, konfiglar, `src/server/contract.ts`, `src/lib/routes.ts`, `src/lib/format.ts`, `src/domain/{money,weight,time}.ts`, `docs/contract.md`, `README.md` |
| operations-engineer | `prisma/**`, `src/domain/{settlement,transitions,errors}.ts`, `src/lib/{db,storage}.ts`, `src/lib/auth/**`, `src/server/**` (contract’dan tashqari), `src/app/api/**`, `scripts/create-user.ts`, `tests/unit/**`, `tests/db/**`, `vitest.config.ts` |
| interface-engineer | `src/app/**` (`api`dan tashqari), `src/components/**`, `src/domain/labels.ts`, `src/lib/client/**`, `public/**` |
| pilot-reviewer | `tests/e2e/**`, `playwright.config.ts`, `docs/review/**` |

Yangi npm paket kerak bo‘lsa — orkestratorga ayt, o‘zing `package.json`ni o‘zgartirma.

# Eco Point · Qarshi karton piloti

Savdo nuqtalaridan toza kartonni kelishilgan vaqtda olib ketish, bir nechta topshirishni bitta reysga birlashtirish, xaridor qabuli va hisob-kitobni yopish uchun mobil-first veb-ilova.

- Hudud: Qarshi · vaqt: Asia/Tashkent · pul: so‘m · vazn: kg
- Uch rol: **do‘kon xodimi**, **yig‘uvchi (hamkor)**, **operator**. Xaridor — operator boshqaradigan tomon (alohida akkaunt emas).
- Demo narxlari, manzillari va tomonlari **shartli**. Haqiqiy tashuvchi, xaridor va tijorat shartlari pilot tashkilotchisi bilan kelishiladi.
- Telegram tokeni, xarita kaliti yoki pulli API kerak emas.

## 1. Talablar
| Dastur | Versiya |
|---|---|
| Node.js | 22.12+ (sinalgan: 22.17) |
| npm | 10+ |
| PostgreSQL | 15+ — quyidagi 3 usuldan biri |

## 2. Baza: uchta usul (bittasini tanlang)
Hammasi bir xil manzilni beradi: `postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint` (+ testlar uchun `ecopoint_test`).

**A. Docker Compose**
```powershell
docker compose up -d
```

**B. Kompyuterdagi PostgreSQL bilan loyiha ichida alohida klaster** (Docker kerak emas; `initdb`/`pg_ctl` PATH’da yoki `C:\Program Files\PostgreSQL\<v>\bin` da bo‘lsa)
```powershell
npm run db:local          # .local/pgdata yaratadi, 5433-portda ishga tushiradi, ikkala bazani yaratadi
npm run db:local:stop     # to‘xtatish
```

**C. Tashqi PostgreSQL** — `.env` dagi `DATABASE_URL` va `TEST_DATABASE_URL` ni o‘zingiznikiga almashtiring (bo‘sh bazalar).

## 3. O‘rnatish va ishga tushirish (Windows PowerShell va bash’da bir xil)
```powershell
Copy-Item .env.example .env      # bash: cp .env.example .env
npm ci
npm run db:migrate               # migratsiyalar
npm run db:seed                  # demo ma’lumot (qayta yurgizish xavfsiz — dublikat bo‘lmaydi)
npm run dev                      # http://localhost:3000
```
Production rejimi:
```powershell
npm run build
npm run start                    # avval migratsiyalarni qo‘llaydi, so‘ng http://localhost:3000
```
`npm run start` platforma bergan `PORT` o‘zgaruvchisini ishlatadi (berilmasa 3000).

### Railway’ga joylash (kam resurs)
Repoda `railway.json` bor — Railway uni o‘zi o‘qiydi: build `npm run build`, start esa migratsiyani qo‘llab, **yengil standalone serverni** ishga tushiradi (`node .next/standalone/server.js`, xotira chegarasi 256 MB, `npm` qobig‘isiz), health check — `/api/health`.

1. Railway’da loyiha → **Deploy from GitHub repo** → shu repo. Yoniga **PostgreSQL** servisini qo‘shing.
2. Ilova servisining **Variables** bo‘limi:
   | O‘zgaruvchi | Qiymat |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway havolasi) |
   | `SESSION_SECRET` | ≥ 32 tasodifiy belgi (standart qiymat bilan ilova ishlamaydi) |
   | `APP_URL` | `https://<sizning-domeningiz>.up.railway.app` |
   | `STORAGE_DIR` | `/data/uploads` (absolyut yo‘l, volume ichida) |
   | `DEMO_MODE` | `false` |
   | `NEXT_TELEMETRY_DISABLED` | `1` |
   | `DATABASE_POOL_MAX` | `3` (ixtiyoriy; standart 5) |
3. **Volume** qo‘shing va `/data` ga ulang — aks holda qayta joylashda yuklangan rasmlar o‘chadi.
4. Resursni tejash: servis **Settings → Serverless (App Sleeping)** ni yoqing — so‘rov bo‘lmaganda ilova uxlaydi, birinchi so‘rovda bir necha soniyada uyg‘onadi. Replikalar soni 1.
5. **Production’da demo akkauntlar ishlamaydi** (talab bo‘yicha). Birinchi operatorni Railway servis terminalida (yoki `railway run`) yarating:
   ```bash
   NEW_USER_PASSWORD=kamida-10-belgili-parol npm run user:create -- --role OPERATOR --login operator1 --name "Operator ismi"
   ```
   Do‘konlar, xodimlar, yig‘uvchilar, xaridor va tarifni operator «Katalog» bo‘limida qo‘shadi.

Boshqa server/konteynerda ham xuddi shunday: `npm ci && npm run build`, so‘ng `npm run start:standalone` (yoki `npm run start`).

Yozuvlar PostgreSQL’da, rasmlar `STORAGE_DIR` (`./storage/uploads`) papkasida — ilova qayta ishga tushganda saqlanadi. Rasmlar ochiq papkada emas, faqat ruxsati bor foydalanuvchiga `/api/files/<id>` orqali beriladi.

## 4. `.env` kalitlari
| Kalit | Ma’nosi |
|---|---|
| `DATABASE_URL` | Ish bazasi |
| `TEST_DATABASE_URL` | Testlar uchun alohida baza (testlar uni tozalaydi) |
| `SESSION_SECRET` | Sessiya tokeni HMAC kaliti, ≥ 32 belgi. Production’da standart qiymat bilan ilova ishlamaydi |
| `STORAGE_DIR` | Yuklangan rasmlar uchun yopiq papka |
| `DEMO_MODE` | `true` — login sahifasida demo akkauntlar va «shartli ma’lumot» belgisi |
| `APP_URL` | Telegram’da ulashiladigan havola uchun tashqi manzil |
| `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS` | DB ulanishlar hovuzi (standart 5 ta, bo‘sh ulanish 10 s da yopiladi) |

## 5. Demo kirish (faqat `DEMO_MODE=true` va production emas)
Parol hammasida: `EcoDemo2026!`. Login sahifasida kartochkani bossangiz, maydonlar to‘ldiriladi.

| Login | Rol | Kim (shartli) |
|---|---|---|
| `dokon1` | Do‘kon | «Nur market», 2 nuqta |
| `dokon2` | Do‘kon | «Bahor savdo» — boshqa do‘kon (izolyatsiya sinovi) |
| `dokon3` | Do‘kon | «Oila supermarketi» |
| `yiguvchi1` | Yig‘uvchi | Hamkor Akmal |
| `yiguvchi2` | Yig‘uvchi | Hamkor Bekzod |
| `operator` | Operator | Eco Point operatori |

Uch rolni bir vaqtda sinash uchun uchta alohida brauzer profili yoki oddiy + inkognito oyna + boshqa brauzer ishlating (sessiya cookie’da).

Demo akkauntlar `isDemo` belgisi bilan yaratiladi va `NODE_ENV=production` da kira olmaydi.

## 6. Pilot foydalanuvchisini yaratish (haqiqiy, demo emas)
```powershell
$env:NEW_USER_PASSWORD = "Kamida-10-belgili-parol"
npm run user:create -- --role OPERATOR --login ali --name "Ali Valiyev" --phone "+998 90 000 00 00"
```
bash: `NEW_USER_PASSWORD='...' npm run user:create -- --role OPERATOR --login ali --name "Ali Valiyev"`.
Do‘kon xodimi uchun `--role SHOP --shop-id <id>` (do‘konni operator «Katalog» bo‘limida yaratadi va u yerda xodim ham qo‘sha oladi). Yig‘uvchini ham operator «Katalog»dan qo‘shadi.

## 7. Testlar
```powershell
npm run lint
npm run typecheck
npm run test:unit        # domain: yaxlitlash, sof vazn, 500/470 hisobi, holat o‘tishlari
npm run test:db          # TEST_DATABASE_URL da: servislar, idempotentlik, parallel to‘lov, ruxsat, audit
npm run test:e2e         # Playwright: 3 alohida sessiya bilan to‘liq oqim (test bazasida, 3100-port)
```
E2E birinchi marta: `npx playwright install chromium`.

## 8. Uch daqiqalik namoyish
1. **(0:00) Do‘kon** — `dokon1` bilan kiring. Bosh sahifada keyingi olib ketish va oxirgi kvitansiya (kechagi reys: vazn, narx, summa, to‘langan, qoldiq). «Olib keting» → nuqta, «Bugun», «15–18», «Tarozisiz → O‘rta», izoh → «Yuborish». «Buyurtma №… yuborildi».
2. **(0:40) Operator** — boshqa oynada `operator`. «Navbat»da yangi buyurtma. 2–3 ta buyurtmani belgilang → «Reys tuzish» → tartibni ↑/↓ bilan o‘zgartiring, yig‘uvchi `Akmal`, xaridor (sifat sharti va minimal partiya ko‘rinadi), narxlar tarifdan → «Reysni saqlash».
3. **(1:20) Yig‘uvchi** — uchinchi oynada `yiguvchi1`. «Bugungi reys»: katta manzil, «Qo‘ng‘iroq qilish». «Tortishni kiritish» → brutto `182,4`, tara `2,4` → sof `180 kg` → (ixtiyoriy tarozi rasmi) → «Tortishni saqlash». Keyingi nuqtada «Karton tayyor emas» → sabab.
4. **(1:50) Do‘kon** — `dokon1` bosh sahifasida «Tasdiqlayman» (yoki «E’tiroz bildirish» → bahs).
5. **(2:10) Operator** — reys sahifasi: qoldirilgan buyurtma navbatga qaytgan. «Xaridor qabuli»: qabul vazni (tafovut bo‘lsa sabab + qaror majburiy), sifat, xaridor tasdig‘i → saqlash. «Pul» bo‘limida xaridor to‘lovi, do‘konlarga, xarajat, reys hissasi, Eco Point xizmat haqi alohida. Xarajat qo‘shing, qisman to‘lov → qoldiq; «Reysni yopish» → «To‘lov kutilmoqda»; qolganini to‘lang → «Yopildi». «Telegram’da ulashish» — havola faqat tizimga kirgan foydalanuvchiga ochiladi.
6. **(2:45)** Kechagi namunaviy reys (180/160/160 → 470 kg): tushum 705 000, do‘konlar 400 000, reys hissasi 5 000, xizmat haqi 3 000 (1 000 to‘langan, qoldiq 2 000) — «To‘lov kutilmoqda».

## 9. Hisob qoidalari (qisqa)
- Sof vazn = brutto − tara; vazn grammda, pul butun so‘mda saqlanadi.
- Summa = vazn × narx, har bekat alohida eng yaqin butun so‘mga (0,5 → yuqoriga) — `src/domain/money.ts`.
- Reys hissasi = xaridor to‘lovi − do‘konlarga − xarajatlar. Eco Point xizmat haqi hamkor hissasidan alohida ko‘rsatiladi va reys daromadiga qayta qo‘shilmaydi.
- Xaridor qabulidagi tafovut do‘konlarga avtomatik yozilmaydi; izoh va operator qarori majburiy.
- Hisoblangan majburiyat va haqiqatda qayd etilgan to‘lov alohida. Pul tizimdan tashqarida o‘tkaziladi.
- Yopilgan reys tuzatilsa: eski/yangi qiymat, sabab, muallif, vaqt auditda; balans qayta hisoblanadi.

## 10. Tuzilma
```
prisma/              schema, migratsiyalar, seed
src/domain/          sof qoidalar: pul, vazn, vaqt, hisob, holat o‘tishlari
src/server/          contract.ts, services/, queries/, actions/
src/app/             sahifalar (shop, collector, operator, login) va api/
src/components/      dizayn tizimi va ekran komponentlari
tests/unit|db|e2e    domain, DB va brauzer testlari
.claude/skills|agents  loyiha skillari va agent ta’riflari
docs/contract.md     umumiy kontrakt: holatlar, ruxsatlar, yo‘nalishlar, fayl egaligi
```

## 11. Pilot chegarasi
Bitta material (karton), bitta hudud (Qarshi), uchta rol. Kiosk, AI, marketplace, to‘lov protsessingi, bonus, GPS kuzatuv va marketing sahifasi keyingi bosqichda.

## 12. Tillar
Butun ilova **o‘zbek / rus / ingliz** tillarida: login, do‘kon, yig‘uvchi va operatorning barcha ekranlari, holat belgilari, sana/kg/so‘m formatlari hamda server xabarlari (xatolar va natijalar). Til **UZ · RU · EN** tugmalari bilan almashtiriladi va brauzerda (`ep_lang` cookie) saqlanadi; standart — o‘zbekcha. Foydalanuvchi kiritgan ma’lumot (izoh, manzil, sabab, nomlar) tarjima qilinmaydi.

Lug‘atlar: `src/i18n/` (`dictionaries.ts` — dashboard va login, `shop.ts`, `operator.ts`, `common.ts`, `labels.ts` — holatlar, `messages.ts` — server xabarlari). Qoidalar: `docs/i18n.md`.

## 13. Loyiha jamoasi
Qarshi davlat universiteti talabalari:
| Ism | Vazifa |
|---|---|
| Yulduz Qayumova | Jamoa rahbari (team lead) |
| Dilnura Ramazonova | Soha mutaxassisi |
| Marjon Jalilova | Bozor tahlilchisi (market analyst) |
| Zarina Ismatullayeva | Full-stack dasturchi |

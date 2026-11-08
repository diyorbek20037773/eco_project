---
name: ecopoint-interface
description: Eco Point pilotining interfeys qoidalari — rollar (do‘kon, yig‘uvchi, operator) bo‘yicha axborot iyerarxiyasi, o‘zbek lotin mikrocopy, vizual til va ranglar, bo‘sh/yuklanish/xato/qayta urinish/muvaffaqiyat holatlari, klaviatura va mobil brauzer tekshiruvi. Sahifa, komponent, forma yoki dizayn tizimi yozilayotganda yoki UI review qilinayotganda qo‘lla.
---

# ecopoint-interface

## Qachon qo‘llanadi
- `src/app/**` (api’dan tashqari), `src/components/**`, `src/app/globals.css`, `src/domain/labels.ts` dagi har qanday ish.
- Yangi ekran, forma, holat matni yoki xato xabari qo‘shilganda; screenshot review’da.

## Vizual til
| Token | Qiymat | Ishlatish |
|---|---|---|
| `--bg` | `#F7F7F2` | iliq oq fon |
| `--ink` | `#17392E` | asosiy matn (fonda kontrast ≈ 11:1) |
| `--primary` | `#176947` | asosiy tugma (oq matn bilan ≈ 6.6:1) |
| `--kraft` | `#EAD8BC` | karton rangidagi och sirt (kvitansiya, ajratilgan blok) |
| `--amber` | `#8A5A00` matn / `#FFF1D6` fon | kechikish — doim «Kechikmoqda» yozuvi bilan |
| `--danger` | `#9B1C1C` matn / `#FDECEC` fon | nizo/bahs — doim «Bahs» yozuvi va ⚠ belgisi bilan |

- Bitta sans-serif (tizim shrift steki: `Inter, "Segoe UI", Roboto, system-ui`), raqamlar `tabular-nums`.
- Belgi: qutining buklama chiziqlaridan ilhomlangan kichik SVG (kvadrat + diagonal buklama + barg). Faqat sarlavhada; operatsion ekranlarda bezak yo‘q.
- Rang yagona signal emas: har holat badge’ida matn bor.

## Axborot iyerarxiyasi
- **Do‘kon** (`/shop`): 1) keyingi olib ketish vaqti; 2) katta «Olib keting» tugmasi; 3) tasdiq kutayotgan tortish (Tasdiqlayman / E’tiroz); 4) oxirgi kvitansiya: vazn, narx, summa, to‘langan, qoldiq, holat; 5) tarix havolasi.
- **Yig‘uvchi** (`/collector`): navbatdagi manzil katta (24px+), mo‘ljal, kontakt va katta «Qo‘ng‘iroq» (`tel:`), vaqt oralig‘i, «keyingi nuqta». Pastda yopishqoq (sticky) bitta kontekst tugma: «Tortishni kiritish» → keyin «Keyingi nuqta». Bir qo‘lda: asosiy amallar ekranning pastki yarmida.
- **Tortish formasi**: `inputMode="decimal"`, `kg` ko‘rinadigan suffiks, sof vazn jonli hisoblanadi (`computeNet`), xato darhol matn bilan; rasm `accept="image/*" capture="environment"`.
- **Operator** (≥1024px): chap navigatsiya (Navbat, Reyslar, Katalog, Audit), markazda tanlanadigan jadval (checkbox), o‘ngda/pastda tanlangan bekatlarning tartibli ro‘yxati (↑/↓, olib tashlash). Hisob sahifasida **Vaznlar** va **Pul** alohida guruh; topshirishlar yig‘indisi va qabul vazni yonma-yon. <768px — jadval mazmunli kartalarga aylanadi.

## Mikrocopy (o‘zbek lotin, qisqa, fe’l bilan)
- Tugmalar: «Olib keting», «Yuborish», «Tortishni saqlash», «Karton tayyor emas», «Keyingi nuqta», «Tasdiqlayman», «E’tiroz bildirish», «Reys tuzish», «Qabulni saqlash», «To‘lovni qayd etish», «Reysni yopish», «Qayta yuborish».
- Holatlar: Yangi · Reysga kiritildi · Olindi — tasdiq kutilmoqda · Qoldirildi · Tasdiqlandi · Bahsli · Hisob yopildi · Bekor qilindi; reys: Rejalashtirilgan · Yo‘lda · Yig‘ib bo‘lindi · Xaridor qabul qildi · To‘lov kutilmoqda · Yopildi · Bekor qilindi.
- Xato: nima bo‘ldi + nima qilish kerak. «Tara bruttodan katta bo‘lishi mumkin emas.» «Internet aloqasi yo‘q. Ma’lumotlar saqlandi — «Qayta yuborish»ni bosing.»
- Tutuq belgisi: `‘` (o‘, g‘) va `’` (tutuq). JSX matnida `'` emas, `‘`/`’` ishlat (eslint `react/no-unescaped-entities`).
- Demo rejimida yuqorida: «Demo rejim: narxlar va manzillar shartli».

## Holatlar (har muhim ekranda)
bo‘sh (nima qilish kerakligi bilan), yuklanish (`loading.tsx` skelet), xato (`error.tsx` + «Qayta urinish»), qayta urinish (tarmoq xatosida forma qiymati saqlanadi, `localStorage` draft, «Qayta yuborish»), muvaffaqiyat (aniq natija: «Buyurtma №12 yuborildi»). Ikki marta bosish: yuborish paytida tugma `disabled` + «Yuborilmoqda…», `clientKey` mount’da bir marta.

## Amaliy qadamlar
1. `docs/contract.md`, `src/server/contract.ts`, `src/lib/format.ts` ni o‘qi; ma’lumotni faqat `src/server/queries/*` va `src/server/actions/*` orqali ol — mock ishlatma.
2. Avval tokenlar va asosiy komponentlar (`Button`, `Field`, `KgInput`, `StatusBadge`, `Card`, `EmptyState`, `ErrorState`, `ActionForm`), keyin ekranlar.
3. Har forma: `<label htmlFor>`, xato `aria-describedby`, `aria-live="polite"` natija.
4. Fokus: `:focus-visible` 3px halqa `#176947` + oq ichki chiziq. Bosish maydoni ≥ 44×44 px.

## Loyihaga xos misol
Yig‘uvchi tortish ekrani: sarlavha «2/3 · Bahor savdo», manzil katta, «Brutto, kg» = `182,4`, «Tara, kg» = `2,4` → «Sof vazn: 180 kg» jonli; tara 190 kiritilsa — qizil chegarali maydon va «Tara bruttodan katta bo‘lishi mumkin emas.», tugma faol emas. Pastda yopishqoq «Tortishni saqlash» (56px). Saqlangach: «Saqlandi: 180 kg. Keyingi nuqta: Oila supermarketi».

## Tekshirish mezoni
- 360, 390 va 1440 px: gorizontal scroll yo‘q (`document.documentElement.scrollWidth <= innerWidth`), matn kesilmaydi, tugmalar ≥ 44 px.
- Klaviatura: Tab bilan barcha amallar, ko‘rinadigan fokus, Enter forma yuboradi.
- Har bir tugma/havola haqiqiy amalni bajaradi (o‘lik tugma yo‘q).
- Kontrast: matn ≥ 4.5:1, katta matn ≥ 3:1.
- `npm run lint` va `npm run typecheck` toza.

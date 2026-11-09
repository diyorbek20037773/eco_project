// Server xabarlarini (ActionResult.error, fieldErrors, message; LoginState.error) tanlangan tilga
// o‘giradi. Servislar o‘zbekcha matn qaytaradi (domen/DB testlari shunga tayanadi); tarjima faqat
// action qatlamida (`src/server/actions/_run.ts`, `auth.ts`) bajariladi.
//
// Qoidalar:
//   - uz: matn va natija obyekti aynan o‘zi qaytariladi (bayt-bayt o‘zgarmaydi).
//   - ru/en: avval statik xarita, so‘ng o‘zgaruvchan qismli shablonlar (raqam, so‘m, buyurtma raqami saqlanadi).
//   - Noma’lum xabar (masalan, zod’ning standart inglizcha matni) o‘zgarmasdan qaytadi — xavfsiz zaxira.
//   - Yangi servis xabari qo‘shilsa, shu yerga tarjimasini yozing: `tests/unit/messages.test.ts`
//     manba fayllardagi barcha xabarlarni o‘qib, tarjimasi borligini tekshiradi.
import type { ActionResult } from "@/server/contract";
import { formatSomL } from "@/lib/format";
import type { Locale } from "./config";

export type Translation = { ru: string; en: string };
type Target = Exclude<Locale, "uz">;

// ---------------------------------------------------------------------------
// Statik xabarlar (o‘zbekcha matn aynan manbadagidek: ‘ ’ belgilari bilan)
// ---------------------------------------------------------------------------
const COMMON: Record<string, Translation> = {
  // src/domain/errors.ts — MESSAGES
  "Avval tizimga kiring.": { ru: "Сначала войдите в систему.", en: "Please sign in first." },
  "Bu amal sizning rolingiz uchun ruxsat etilmagan.": { ru: "Это действие недоступно для вашей роли.", en: "This action is not available for your role." },
  "Ma’lumot topilmadi yoki unga ruxsatingiz yo‘q.": { ru: "Данные не найдены или у вас нет к ним доступа.", en: "The record was not found or you don't have access to it." },
  "Formadagi xatolarni tuzating.": { ru: "Исправьте ошибки в форме.", en: "Please correct the errors in the form." },
  "Bu amalni joriy holatda bajarib bo‘lmaydi.": { ru: "Это действие недоступно в текущем статусе.", en: "This action isn't available in the current status." },
  "Ma’lumot boshqa foydalanuvchi tomonidan o‘zgartirildi. Sahifani yangilab qayta urinib ko‘ring.": {
    ru: "Данные изменил другой пользователь. Обновите страницу и попробуйте ещё раз.",
    en: "Another user has changed this record. Refresh the page and try again.",
  },
  "Bunday yozuv allaqachon mavjud.": { ru: "Такая запись уже существует.", en: "This record already exists." },
  "To‘lov summasi qoldiqdan oshib ketdi.": { ru: "Сумма платежа превышает остаток.", en: "The payment amount exceeds the remaining balance." },
  "Faqat 5 MB gacha JPEG, PNG yoki WebP rasm yuklash mumkin.": {
    ru: "Можно загрузить только изображение JPEG, PNG или WebP размером до 5 МБ.",
    en: "You can upload only a JPEG, PNG or WebP image up to 5 MB.",
  },
  "Kutilmagan xato. Qayta urinib ko‘ring.": { ru: "Непредвиденная ошибка. Попробуйте ещё раз.", en: "Something went wrong. Please try again." },

  // src/server/services/auth.ts, src/server/actions/auth.ts
  "Login yoki parol noto‘g‘ri.": { ru: "Неверный логин или пароль.", en: "Incorrect login or password." },
  "Akkaunt o‘chirilgan. Operatorga murojaat qiling.": { ru: "Аккаунт отключён. Обратитесь к оператору.", en: "This account is disabled. Please contact the operator." },
  "Demo akkauntlar ishlab chiqarish rejimida ishlamaydi.": { ru: "Демо-аккаунты не работают в рабочем режиме (production).", en: "Demo accounts are disabled in production mode." },
  "Login va parolni kiriting.": { ru: "Введите логин и пароль.", en: "Enter your login and password." },

  // src/server/services/core.ts
  "Buyurtma holati o‘zgargan. Sahifani yangilang.": { ru: "Статус заявки изменился. Обновите страницу.", en: "The request status has changed. Refresh the page." },
  "Reys holati o‘zgargan. Sahifani yangilang.": { ru: "Статус рейса изменился. Обновите страницу.", en: "The trip status has changed. Refresh the page." },
  "Bekat holati o‘zgargan. Sahifani yangilang.": { ru: "Статус остановки изменился. Обновите страницу.", en: "The stop status has changed. Refresh the page." },
  "Bahs holati o‘zgargan. Sahifani yangilang.": { ru: "Статус спора изменился. Обновите страницу.", en: "The dispute status has changed. Refresh the page." },
  "Noto‘g‘ri identifikator.": { ru: "Неверный идентификатор. Обновите страницу и попробуйте ещё раз.", en: "Invalid identifier. Refresh the page and try again." },
  "Forma kaliti yo‘q. Sahifani yangilang.": { ru: "Отсутствует ключ формы. Обновите страницу.", en: "The form key is missing. Refresh the page." },
  "Forma kaliti juda uzun.": { ru: "Ключ формы слишком длинный. Обновите страницу.", en: "The form key is too long. Refresh the page." },
  "Sanani tanlang.": { ru: "Выберите дату.", en: "Choose a date." },
  "Vaqtni SS:dd ko‘rinishida kiriting.": { ru: "Укажите время в формате ЧЧ:мм.", en: "Enter the time as HH:mm." },
  "Telefon raqamini to‘g‘ri kiriting, masalan +998 90 123 45 67.": {
    ru: "Укажите номер телефона правильно, например +998 90 123 45 67.",
    en: "Enter a valid phone number, e.g. +998 90 123 45 67.",
  },
  "Login 3–32 belgi: lotin harflari, raqam, nuqta, chiziqcha.": {
    ru: "Логин: 3–32 символа — латинские буквы, цифры, точка, дефис.",
    en: "Login: 3–32 characters — Latin letters, digits, dot, hyphen.",
  },

  // src/server/services/catalog.ts
  "Parolni kiriting.": { ru: "Введите пароль.", en: "Enter a password." },
  "Parol juda uzun.": { ru: "Пароль слишком длинный.", en: "The password is too long." },
  "Nuqta nomini yozing.": { ru: "Укажите название точки.", en: "Enter the point name." },
  "Manzilni yozing.": { ru: "Укажите адрес.", en: "Enter the address." },
  "Hududni (mahalla/tuman) yozing.": { ru: "Укажите район (махалля/туман).", en: "Enter the area (mahalla/district)." },
  "Ismni yozing.": { ru: "Укажите имя.", en: "Enter the name." },
  "Bu login band. Boshqa login tanlang.": { ru: "Этот логин уже занят. Выберите другой.", en: "This login is already taken. Choose another one." },
  "Bu login band.": { ru: "Этот логин занят.", en: "This login is taken." },
  "Do‘kon nomini yozing.": { ru: "Укажите название магазина.", en: "Enter the shop name." },
  "Do‘kon qo‘shildi.": { ru: "Магазин добавлен.", en: "Shop added." },
  "Bu do‘konda shu nomli nuqta bor.": {
    ru: "У этого магазина уже есть точка с таким названием. Выберите другое название.",
    en: "This shop already has a point with this name. Choose a different name.",
  },
  "Bu nom band.": { ru: "Это название уже занято.", en: "This name is already taken." },
  "Nuqta qo‘shildi.": { ru: "Точка добавлена.", en: "Point added." },
  "Xodim qo‘shildi.": { ru: "Сотрудник добавлен.", en: "Staff member added." },
  "Yig‘uvchi qo‘shildi.": { ru: "Сборщик добавлен.", en: "Collector added." },
  "Minimal partiyani kg’da kiriting, masalan 300.": { ru: "Укажите минимальную партию в кг, например 300.", en: "Enter the minimum batch in kg, e.g. 300." },
  "Xaridor nomini yozing.": { ru: "Укажите название покупателя.", en: "Enter the buyer name." },
  "Sifat shartlarini yozing.": { ru: "Укажите требования к качеству.", en: "Enter the quality requirements." },
  "Bu nomli xaridor bor.": {
    ru: "Покупатель с таким названием уже есть. Выберите другое название.",
    en: "A buyer with this name already exists. Choose a different name.",
  },
  "Xaridor qo‘shildi.": { ru: "Покупатель добавлен.", en: "Buyer added." },
  "Xaridor ma’lumoti saqlandi.": { ru: "Данные покупателя сохранены.", en: "Buyer details saved." },
  "Yangi tarif saqlandi. Yangi reyslarga qo‘llanadi.": { ru: "Новый тариф сохранён. Он применяется к новым рейсам.", en: "New tariff saved. It applies to new trips." },

  // src/server/services/collector.ts
  "Brutto vaznni kg’da kiriting, masalan 185 yoki 185,5.": { ru: "Укажите вес брутто в кг, например 185 или 185,5.", en: "Enter the gross weight in kg, e.g. 185 or 185.5." },
  "Tarani kg’da kiriting yoki bo‘sh qoldiring.": { ru: "Укажите тару в кг или оставьте поле пустым.", en: "Enter the tare in kg or leave it empty." },
  "Brutto vaznni kiriting.": { ru: "Укажите вес брутто.", en: "Enter the gross weight." },
  "Bu bekat allaqachon tortilgan.": { ru: "На этой остановке вес уже записан.", en: "This stop has already been weighed." },
  "Bu bekat qoldirilgan. Tortib bo‘lmaydi.": { ru: "Эта остановка пропущена, взвешивание недоступно.", en: "This stop was skipped, so it can't be weighed." },
  "Bu bekatda tortish kiritib bo‘lmaydi.": { ru: "Для этой остановки нельзя записать вес.", en: "A weighing can't be recorded for this stop." },
  "Reys faol emas.": { ru: "Рейс не активен.", en: "The trip is not active." },
  "Vazn saqlandi.": { ru: "Вес сохранён.", en: "Weight saved." },
  "Qoldirish sababini yozing.": { ru: "Укажите причину пропуска.", en: "Enter the reason for skipping." },
  "Bu bekatni qoldirib bo‘lmaydi: u allaqachon olingan.": { ru: "Эту остановку нельзя пропустить: картон уже забран.", en: "This stop can't be skipped: it has already been collected." },
  "Bekat qoldirildi. Operator qayta rejalashtiradi.": { ru: "Остановка пропущена. Оператор запланирует её заново.", en: "Stop skipped. The operator will reschedule it." },

  // src/server/services/shop.ts
  "Akkauntingiz do‘konga biriktirilmagan. Operatorga murojaat qiling.": {
    ru: "Ваш аккаунт не привязан к магазину. Обратитесь к оператору.",
    en: "Your account isn't linked to a shop. Please contact the operator.",
  },
  "Hajmni tanlang.": { ru: "Выберите объём.", en: "Choose the volume." },
  "Nuqta topilmadi. Ro‘yxatdan tanlang.": { ru: "Точка не найдена. Выберите её из списка.", en: "Point not found. Choose one from the list." },
  "O‘tgan sanani tanlab bo‘lmaydi.": { ru: "Нельзя выбрать прошедшую дату.", en: "You can't choose a past date." },
  "Sana yoki vaqt noto‘g‘ri.": { ru: "Неверная дата или время. Проверьте значения.", en: "Invalid date or time. Please check them." },
  "Tugash vaqti boshlanishidan keyin bo‘lsin.": { ru: "Время окончания должно быть позже времени начала.", en: "The end time must be after the start time." },
  "Taxminiy vazn yoki hajmni belgilang.": { ru: "Укажите примерный вес или объём.", en: "Specify an estimated weight or volume." },
  "Tarozi bo‘lmasa, taxminiy hajmni tanlang.": { ru: "Если нет весов, выберите примерный объём.", en: "If you don't have scales, choose an approximate volume." },
  "Buyurtma qabul qilindi.": { ru: "Заявка принята.", en: "Request received." },
  "Reysga kiritilgan yoki olingan buyurtmani bekor qilib bo‘lmaydi.": {
    ru: "Заявку, которая уже включена в рейс или забрана, отменить нельзя.",
    en: "A request that is already on a trip or collected can't be cancelled.",
  },
  "Buyurtma bekor qilindi.": { ru: "Заявка отменена.", en: "Request cancelled." },
  "Bu vazn bo‘yicha e’tiroz bildirilgan. Bahs qarorini kuting.": {
    ru: "По этому весу уже подано возражение. Дождитесь решения по спору.",
    en: "An objection to this weight has already been filed. Please wait for the dispute decision.",
  },
  "Vazn hali kiritilmagan.": { ru: "Вес ещё не записан.", en: "The weight hasn't been recorded yet." },
  "Reys yopilgan.": { ru: "Рейс закрыт.", en: "The trip is closed." },
  "Bu vazn bo‘yicha e’tiroz bildirilgan.": { ru: "По этому весу уже подано возражение.", en: "An objection to this weight has already been filed." },
  "Vazn tasdiqlandi.": { ru: "Вес подтверждён.", en: "Weight confirmed." },
  "E’tiroz sababini yozing (kamida 5 belgi).": { ru: "Укажите причину возражения (не менее 5 символов).", en: "Enter the reason for the objection (at least 5 characters)." },
  "Vazn allaqachon tasdiqlangan.": { ru: "Вес уже подтверждён.", en: "The weight has already been confirmed." },
  "E’tiroz yuborildi. Operator qarorini kuting.": { ru: "Возражение отправлено. Дождитесь решения оператора.", en: "Objection sent. Please wait for the operator's decision." },
  "Rozimisiz yoki yo‘qmi — tanlang.": { ru: "Выберите: согласны вы или нет.", en: "Choose whether you agree or not." },
  "Nega rozi emasligingizni yozing.": { ru: "Напишите, почему вы не согласны.", en: "Write why you disagree." },
  "Operator hali qaror qabul qilmagan.": { ru: "Оператор ещё не принял решение. Дождитесь его.", en: "The operator hasn't made a decision yet. Please wait." },
  "Bahs hal qilindi.": { ru: "Спор урегулирован.", en: "Dispute resolved." },
  "E’tirozingiz operatorga qaytarildi.": { ru: "Ваше возражение возвращено оператору.", en: "Your objection has been sent back to the operator." },
  "Roziligingiz qayd etildi.": { ru: "Ваше согласие записано.", en: "Your agreement has been recorded." },

  // src/server/services/trips.ts
  "Kamida bitta buyurtmani tanlang.": { ru: "Выберите хотя бы одну заявку.", en: "Select at least one request." },
  "Bitta buyurtma ikki marta tanlangan.": { ru: "Одна и та же заявка выбрана дважды.", en: "The same request is selected twice." },
  "Yig‘uvchini tanlang.": { ru: "Выберите сборщика.", en: "Choose a collector." },
  "Xaridorni tanlang.": { ru: "Выберите покупателя.", en: "Choose a buyer." },
  "Ba’zi buyurtmalar topilmadi. Navbatni yangilang.": { ru: "Некоторые заявки не найдены. Обновите очередь.", en: "Some requests were not found. Refresh the queue." },
  "Buyurtma boshqa reysga kiritilgan. Navbatni yangilang.": { ru: "Заявка уже включена в другой рейс. Обновите очередь.", en: "The request is already on another trip. Refresh the queue." },
  "Reys yaratildi.": { ru: "Рейс создан.", en: "Trip created." },
  "Kamida bitta bekat qolsin. Reysni bekor qilish uchun «Bekor qilish»ni bosing.": {
    ru: "Должна остаться хотя бы одна остановка. Чтобы отменить рейс, воспользуйтесь отменой рейса.",
    en: "At least one stop must remain. To cancel the trip, use the trip cancellation action.",
  },
  "Bitta buyurtma ikki marta berilgan.": { ru: "Одна и та же заявка указана дважды.", en: "The same request is listed twice." },
  "Faqat boshlanmagan reys tartibini o‘zgartirish mumkin.": {
    ru: "Порядок остановок можно менять только до начала рейса.",
    en: "The stop order can be changed only before the trip starts.",
  },
  "Ro‘yxatda shu reysga tegishli bo‘lmagan buyurtma bor.": {
    ru: "В списке есть заявка, не относящаяся к этому рейсу. Обновите страницу.",
    en: "The list contains a request that doesn't belong to this trip. Refresh the page.",
  },
  "Bekatlar tartibi saqlandi.": { ru: "Порядок остановок сохранён.", en: "Stop order saved." },
  "Bekor qilish sababini yozing.": { ru: "Укажите причину отмены.", en: "Enter the cancellation reason." },
  "Faqat boshlanmagan reysni bekor qilish mumkin.": { ru: "Отменить можно только рейс, который ещё не начался.", en: "Only a trip that hasn't started can be cancelled." },
  "Reys boshlangan yoki o‘zgargan. Sahifani yangilang.": { ru: "Рейс уже начался или изменился. Обновите страницу.", en: "The trip has started or changed. Refresh the page." },
  "Reys bekor qilindi. Buyurtmalar navbatga qaytdi.": { ru: "Рейс отменён. Заявки вернулись в очередь.", en: "Trip cancelled. The requests are back in the queue." },
  "Qaror matnini yozing (kamida 5 belgi).": { ru: "Укажите текст решения (не менее 5 символов).", en: "Enter the decision text (at least 5 characters)." },
  "Yakuniy vaznni kiriting.": { ru: "Укажите итоговый вес.", en: "Enter the final weight." },
  "Yakuniy vaznni kg’da kiriting.": { ru: "Укажите итоговый вес в кг.", en: "Enter the final weight in kg." },
  "Qaror allaqachon qabul qilingan, tomonlar javobini kuting.": {
    ru: "Решение уже принято. Дождитесь ответа сторон.",
    en: "A decision has already been made. Please wait for the parties to respond.",
  },
  "Bahs allaqachon hal qilingan.": { ru: "Спор уже урегулирован.", en: "The dispute has already been resolved." },
  "Qaror saqlandi. Do‘kon va yig‘uvchi roziligi kutilmoqda.": {
    ru: "Решение сохранено. Ожидается согласие магазина и сборщика.",
    en: "Decision saved. Waiting for the shop and the collector to agree.",
  },
  "Qabul vaznini kiriting.": { ru: "Укажите принятый вес.", en: "Enter the accepted weight." },
  "Sifatni tanlang.": { ru: "Выберите качество.", en: "Choose the quality." },
  "Operator qarorini tanlang.": { ru: "Выберите решение оператора.", en: "Choose the operator decision." },
  "Xaridor tasdig‘ini kiriting: nakladnoy raqami yoki qabul qilgan shaxs.": {
    ru: "Укажите подтверждение покупателя: номер накладной или имя принявшего.",
    en: "Enter the buyer's confirmation: waybill number or the name of the person who accepted it.",
  },
  "Qabul vaznini kg’da kiriting.": { ru: "Укажите принятый вес в кг.", en: "Enter the accepted weight in kg." },
  "Qabul vaqti kelajakda bo‘lmaydi.": { ru: "Время приёмки не может быть в будущем.", en: "The acceptance time can't be in the future." },
  "Barcha bekatlar olinmaguncha xaridor qabulini kiritib bo‘lmaydi.": {
    ru: "Приёмку покупателя можно внести только после завершения всех остановок.",
    en: "The buyer acceptance can be recorded only after all stops are completed.",
  },
  "Bu reys uchun xaridor qabuli allaqachon kiritilgan yoki reys yopilgan.": {
    ru: "Приёмка покупателя по этому рейсу уже внесена, или рейс закрыт.",
    en: "The buyer acceptance for this trip has already been recorded, or the trip is closed.",
  },
  "Tafovut bor: sababini yozing.": { ru: "Есть расхождение: укажите его причину.", en: "There is a discrepancy: enter its reason." },
  "Tafovut bor: operator qarorini tanlang.": { ru: "Есть расхождение: выберите решение оператора.", en: "There is a discrepancy: choose the operator decision." },
  "Qaror izohini yozing.": { ru: "Напишите комментарий к решению.", en: "Enter a decision note." },
  "Xaridor qabuli saqlandi. Majburiyatlar hisoblandi.": { ru: "Приёмка покупателя сохранена. Обязательства рассчитаны.", en: "Buyer acceptance saved. Obligations calculated." },
  "Kim to‘laganini tanlang.": { ru: "Выберите, кто оплатил.", en: "Choose who paid." },
  "Xarajat turini tanlang.": { ru: "Выберите тип расхода.", en: "Choose the expense type." },
  "Xarajat summasi 0 dan katta bo‘lsin.": { ru: "Сумма расхода должна быть больше 0.", en: "The expense amount must be greater than 0." },
  "Yopilgan yoki bekor qilingan reysga xarajat qo‘shib bo‘lmaydi. Kerak bo‘lsa tuzatish kiriting.": {
    ru: "В закрытый или отменённый рейс нельзя добавить расход. При необходимости внесите исправление.",
    en: "Expenses can't be added to a closed or cancelled trip. Record a correction if needed.",
  },
  "Xarajat qo‘shildi.": { ru: "Расход добавлен.", en: "Expense added." },
  "To‘lov summasi 0 dan katta bo‘lsin.": { ru: "Сумма платежа должна быть больше 0.", en: "The payment amount must be greater than 0." },
  "To‘lov sanasi kelajakda bo‘lmaydi.": { ru: "Дата платежа не может быть в будущем.", en: "The payment date can't be in the future." },
  "To‘lovni xaridor qabulidan keyin kiritish mumkin.": { ru: "Платёж можно внести после приёмки покупателя.", en: "Payments can be recorded after the buyer acceptance." },
  "Ortiqcha to‘lov yo‘q — qaytarish kiritib bo‘lmaydi.": { ru: "Переплаты нет — возврат внести нельзя.", en: "There is no overpayment, so a refund can't be recorded." },
  "Bu majburiyat to‘liq to‘langan. Takroriy to‘lov kiritilmadi.": {
    ru: "Это обязательство уже полностью оплачено. Повторный платёж не записан.",
    en: "This obligation is already fully paid. The duplicate payment was not recorded.",
  },
  "To‘lov qayd etildi. Majburiyat to‘liq yopildi.": { ru: "Платёж записан. Обязательство полностью погашено.", en: "Payment recorded. The obligation is fully settled." },
  "Bekor qilingan reysni yopib bo‘lmaydi.": { ru: "Отменённый рейс закрыть нельзя.", en: "A cancelled trip can't be closed." },
  "Shartlar bajarildi, lekin to‘lov qoldi. Reys «To‘lov kutilmoqda» holatida.": {
    ru: "Условия выполнены, но остались платежи. Рейс в статусе «Ожидает оплаты».",
    en: "All conditions are met, but payments remain. The trip is now “Awaiting payment”.",
  },
  "Ba’zi buyurtmalar hali tasdiqlanmagan.": { ru: "Некоторые заявки ещё не подтверждены.", en: "Some requests haven't been confirmed yet." },
  "Reys yopildi.": { ru: "Рейс закрыт.", en: "Trip closed." },
  "Tuzatish sababini yozing (kamida 5 belgi).": { ru: "Укажите причину исправления (не менее 5 символов).", en: "Enter the reason for the correction (at least 5 characters)." },
  "Tuzatish faqat xaridor qabulidan keyin kiritiladi. Undan oldin amaldagi formadan foydalaning.": {
    ru: "Исправление вносится только после приёмки покупателя. До этого используйте обычную форму.",
    en: "Corrections are recorded only after the buyer acceptance. Before that, use the regular form.",
  },
  "Yangi qiymat avvalgisi bilan bir xil.": { ru: "Новое значение совпадает с прежним. Укажите другое значение.", en: "The new value is the same as the previous one. Enter a different value." },
  "Tuzatish saqlandi. Hisob qayta hisoblandi.": { ru: "Исправление сохранено. Расчёт обновлён.", en: "Correction saved. The settlement has been recalculated." },

  // src/server/services/upload.ts
  "Fayl turi noto‘g‘ri.": { ru: "Неверный тип файла.", en: "Invalid file type." },
  "Rasm tanlanmagan.": { ru: "Изображение не выбрано. Выберите фото.", en: "No image selected. Choose a photo." },
  "Rasm hajmi 5 MB dan oshmasin.": { ru: "Размер изображения не должен превышать 5 МБ.", en: "The image must not exceed 5 MB." },
  "Faqat JPEG, PNG yoki WebP rasm yuklash mumkin.": { ru: "Можно загрузить только изображение JPEG, PNG или WebP.", en: "Only JPEG, PNG or WebP images can be uploaded." },
  "Ko‘pi bilan 10 ta rasm biriktiring.": { ru: "Прикрепите не более 10 изображений.", en: "Attach no more than 10 images." },
  "Rasm topilmadi yoki allaqachon boshqa yozuvga biriktirilgan. Qayta yuklang.": {
    ru: "Изображение не найдено или уже прикреплено к другой записи. Загрузите его заново.",
    en: "The image was not found or is already attached to another record. Please upload it again.",
  },
  "Rasmni qayta yuklang.": { ru: "Загрузите изображение заново.", en: "Please upload the image again." },

  // src/domain/weight.ts — NET_ERROR_TEXT
  "Brutto vaznni kiriting (kg).": { ru: "Укажите вес брутто (кг).", en: "Enter the gross weight (kg)." },
  "Tara manfiy bo‘lishi mumkin emas.": { ru: "Тара не может быть отрицательной.", en: "The tare can't be negative." },
  "Tara bruttodan katta bo‘lishi mumkin emas.": { ru: "Тара не может быть больше брутто.", en: "The tare can't be greater than the gross weight." },
  "Brutto juda katta. Kg’da kiritganingizni tekshiring.": { ru: "Брутто слишком большое. Проверьте, что вес указан в кг.", en: "The gross weight is too large. Check that it's entered in kg." },
  "Sof vazn 0 kg chiqdi. Brutto va tarani tekshiring.": { ru: "Вес нетто получился 0 кг. Проверьте брутто и тару.", en: "The net weight is 0 kg. Check the gross and tare values." },

  // src/domain/settlement.ts — CLOSE_CHECK_LABELS (UI odatda `key` bo‘yicha o‘z lug‘atidan oladi)
  "Barcha bekatlar olingan yoki qoldirilgan": { ru: "Все остановки пройдены или пропущены", en: "All stops collected or skipped" },
  "Do‘konlar vaznni tasdiqlagan yoki bahs hal qilingan": { ru: "Магазины подтвердили вес или спор урегулирован", en: "Shops confirmed the weight or the dispute is resolved" },
  "Xaridor qabuli kiritilgan": { ru: "Приёмка покупателя внесена", en: "Buyer acceptance recorded" },
  "Ochiq bahs yo‘q": { ru: "Нет открытых споров", en: "No open disputes" },
  "Barcha majburiyatlar to‘langan": { ru: "Все обязательства оплачены", en: "All obligations paid" },
};

/** src/domain/settlement.ts — CLOSE_CHECK_MISSING: «Reysni yopib bo‘lmaydi: …» ichidagi qismlar. */
export const CLOSE_MISSING_PARTS: Record<string, Translation> = {
  "hali olinmagan yoki qoldirilmagan bekat bor": {
    ru: "есть остановки, которые ещё не пройдены и не пропущены",
    en: "some stops are neither collected nor skipped yet",
  },
  "do‘kon tasdig‘i yoki bahs qarori kutilmoqda": { ru: "ожидается подтверждение магазина или решение по спору", en: "waiting for shop confirmation or a dispute decision" },
  "xaridor qabuli kiritilmagan": { ru: "приёмка покупателя не внесена", en: "the buyer acceptance hasn't been recorded" },
  "hal qilinmagan bahs bor": { ru: "есть неурегулированный спор", en: "there is an unresolved dispute" },
  "to‘lanmagan majburiyat bor": { ru: "есть неоплаченное обязательство", en: "there is an unpaid obligation" },
};

export const STATIC_MESSAGES: Readonly<Record<string, Translation>> = { ...COMMON, ...CLOSE_MISSING_PARTS };

/**
 * Shablonli xabarlardagi maydon nomlari (zText/zOptText/zSom/parseOptionalKg `label` argumenti).
 * ru/en shablonlarda «Nom: …» ko‘rinishida ishlatiladi (rus tilida kelishik muammosi bo‘lmasin).
 */
export const FIELD_LABELS: Readonly<Record<string, Translation>> = {
  Matn: { ru: "Текст", en: "Text" },
  Vazn: { ru: "Вес", en: "Weight" },
  "Kontakt ismi": { ru: "Контактное лицо", en: "Contact name" },
  "Mo‘ljal": { ru: "Ориентир", en: "Landmark" },
  Manzil: { ru: "Адрес", en: "Address" },
  Izoh: { ru: "Комментарий", en: "Note" },
  Sabab: { ru: "Причина", en: "Reason" },
  Transport: { ru: "Транспорт", en: "Vehicle" },
  "Sifat izohi": { ru: "Комментарий о качестве", en: "Quality note" },
  "Tafovut sababi": { ru: "Причина расхождения", en: "Discrepancy reason" },
  "Qaror izohi": { ru: "Комментарий к решению", en: "Decision note" },
  Oluvchi: { ru: "Получатель", en: "Recipient" },
  "To‘lov usuli": { ru: "Способ оплаты", en: "Payment method" },
  "Izoh/raqam": { ru: "Комментарий/номер", en: "Note/reference" },
  "Do‘kon narxi": { ru: "Цена для магазина", en: "Shop price" },
  "Xaridor narxi": { ru: "Цена покупателя", en: "Buyer price" },
  "Xizmat haqi": { ru: "Сервисный сбор", en: "Service fee" },
  "Xarajat summasi": { ru: "Сумма расхода", en: "Expense amount" },
  "To‘lov summasi": { ru: "Сумма платежа", en: "Payment amount" },
  "Taxminiy vazn": { ru: "Примерный вес", en: "Estimated weight" },
  "Sizning vazningiz": { ru: "Ваш вес", en: "Your weight" },
  "Yakuniy vazn": { ru: "Итоговый вес", en: "Final weight" },
  "Qabul vazni": { ru: "Принятый вес", en: "Accepted weight" },
};

/** src/domain/transitions.ts — NAMES (assertTransition standart xabari uchun). */
const MACHINE_NAMES: Readonly<Record<string, Translation>> = {
  Buyurtma: { ru: "Заявка", en: "Request" },
  Reys: { ru: "Рейс", en: "Trip" },
  Bekat: { ru: "Остановка", en: "Stop" },
  Bahs: { ru: "Спор", en: "Dispute" },
};

// ---------------------------------------------------------------------------
// Shablonlar
// ---------------------------------------------------------------------------
/** formatSom natijasi: "12 000 so‘m", "−5 000 so‘m" (oddiy yoki bo‘linmas bo‘shliq). */
const SOM = "(−?\\d{1,3}(?:[ \\u00A0]\\d{3})*)[ \\u00A0]so‘m";

function somIn(uzAmount: string, locale: Target): string {
  const negative = uzAmount.startsWith("−");
  const n = Number(uzAmount.replace(/\D/g, ""));
  return formatSomL(negative ? -n : n, locale);
}

function label(uz: string, locale: Target): string | null {
  return FIELD_LABELS[uz]?.[locale] ?? null;
}

/** `m` — regex guruhlari (topilmagan guruh → ""). */
type Groups = readonly [string, string, string, ...string[]];
type Render = (m: Groups, locale: Target) => string | null;
interface TemplateRule {
  re: RegExp;
  render: Render;
}

/** Ikki tilli shablon: `{1}`, `{2}` — regex guruhlari; `L` — guruh 1 maydon nomi sifatida. */
function withLabel(re: RegExp, ru: string, en: string): TemplateRule {
  return {
    re,
    render: (m, locale) => {
      const l = label(m[1], locale);
      if (l === null) return null;
      return (locale === "ru" ? ru : en).replace("{L}", l).replace("{2}", m[2]);
    },
  };
}

function plain(re: RegExp, ru: string, en: string): TemplateRule {
  return { re, render: (m, locale) => (locale === "ru" ? ru : en).replace("{1}", m[1]) };
}

export const TEMPLATE_RULES: readonly TemplateRule[] = [
  // core.ts: zText/zOptText/zRequiredText
  withLabel(/^(.+?) (\d+) belgidan oshmasin\.$/, "{L}: не более {2} символов.", "{L}: at most {2} characters."),
  // core.ts: zSom
  withLabel(/^(.+?)ni so‘mda kiriting\.$/, "{L}: укажите сумму в сумах.", "{L}: enter the amount in UZS."),
  withLabel(/^(.+?) butun so‘m bo‘lsin\.$/, "{L}: укажите целое число сумов.", "{L}: enter a whole number of UZS."),
  withLabel(/^(.+?) manfiy bo‘lmaydi\.$/, "{L}: значение не может быть отрицательным.", "{L}: the value can't be negative."),
  withLabel(/^(.+?) juda katta\.$/, "{L}: слишком большое значение. Проверьте ввод.", "{L}: the value is too large. Please check it."),
  // shop.ts: parseOptionalKg
  withLabel(/^(.+?)ni kg’da kiriting, masalan 45 yoki 45,5\.$/, "{L}: укажите вес в кг, например 45 или 45,5.", "{L}: enter the weight in kg, e.g. 45 or 45.5."),
  withLabel(/^(.+?) 0 kg’dan katta bo‘lsin\.$/, "{L}: вес должен быть больше 0 кг.", "{L}: the weight must be greater than 0 kg."),
  withLabel(
    /^(.+?) juda katta\. Kg’da kiritganingizni tekshiring\.$/,
    "{L}: слишком большой вес. Проверьте, что он указан в кг.",
    "{L}: the weight is too large. Check that it's entered in kg.",
  ),
  // catalog.ts
  plain(/^Parol kamida (\d+) belgi bo‘lsin\.$/, "Пароль должен содержать не менее {1} символов.", "The password must be at least {1} characters long."),
  // shop.ts
  plain(/^Sana (\d+) kundan uzoq bo‘lmasin\.$/, "Выберите дату в пределах ближайших {1} дн.", "The date must be within {1} days from today."),
  // trips.ts
  plain(/^Bitta reysda ko‘pi bilan (\d+) bekat\.$/, "В одном рейсе может быть не более {1} остановок.", "A trip can have at most {1} stops."),
  {
    re: /^(#\d+(?:, #\d+)*) buyurtma allaqachon reysga kiritilgan yoki yopilgan\. Navbatni yangilang\.$/,
    render: (m, locale) => {
      const many = m[1].includes(",");
      if (locale === "ru") {
        return many
          ? `Заявки ${m[1]} уже включены в рейс или закрыты. Обновите очередь.`
          : `Заявка ${m[1]} уже включена в рейс или закрыта. Обновите очередь.`;
      }
      return many
        ? `Requests ${m[1]} are already on a trip or closed. Refresh the queue.`
        : `Request ${m[1]} is already on a trip or closed. Refresh the queue.`;
    },
  },
  {
    re: new RegExp(`^Summa qoldiqdan oshib ketdi\\. Ko‘pi bilan ${SOM} kiritish mumkin\\.$`),
    render: (m, locale) =>
      locale === "ru"
        ? `Сумма превышает остаток. Можно внести не более ${somIn(m[1], locale)}.`
        : `The amount exceeds the remaining balance. You can enter at most ${somIn(m[1], locale)}.`,
  },
  {
    re: new RegExp(`^To‘lov qayd etildi\\. Qoldiq: ${SOM}\\.$`),
    render: (m, locale) =>
      locale === "ru" ? `Платёж записан. Остаток: ${somIn(m[1], locale)}.` : `Payment recorded. Remaining: ${somIn(m[1], locale)}.`,
  },
  {
    re: /^Reysni yopib bo‘lmaydi: (.+)\.$/,
    render: (m, locale) => {
      const parts = m[1].split("; ").map((p) => CLOSE_MISSING_PARTS[p]?.[locale] ?? null);
      if (parts.some((p) => p === null)) return null;
      return (locale === "ru" ? "Рейс нельзя закрыть: " : "The trip can't be closed: ") + parts.join("; ") + ".";
    },
  },
  // transitions.ts: assertTransition
  {
    re: /^(\S+) joriy holatda bu amalni bajarib bo‘lmaydi\.$/,
    render: (m, locale) => {
      const name = MACHINE_NAMES[m[1]]?.[locale];
      if (!name) return null;
      return locale === "ru" ? `${name}: это действие недоступно в текущем статусе.` : `${name}: this action isn't available in the current status.`;
    },
  },
];

// ---------------------------------------------------------------------------
// Ochiq API
// ---------------------------------------------------------------------------
/** O‘zbekcha server xabarini tanlangan tilga o‘giradi. uz yoki noma’lum xabar — o‘zgarmaydi. */
export function translateMessage(text: string, locale: Locale): string {
  if (locale === "uz") return text;
  const hit = STATIC_MESSAGES[text];
  if (hit) return hit[locale];
  for (const rule of TEMPLATE_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    const groups = [...Array.from(m, (g) => g ?? ""), "", ""] as unknown as Groups;
    const out = rule.render(groups, locale);
    if (out !== null) return out;
  }
  return text;
}

/** ActionResult’dagi foydalanuvchi matnlarini (error, fieldErrors, message) o‘giradi. uz — aynan o‘sha obyekt. */
export function localizeResult<T>(result: ActionResult<T>, locale: Locale): ActionResult<T> {
  if (locale === "uz") return result;
  if (result.ok) {
    return result.message === undefined ? result : { ...result, message: translateMessage(result.message, locale) };
  }
  const out: Extract<ActionResult<T>, { ok: false }> = { ...result, error: translateMessage(result.error, locale) };
  if (result.fieldErrors) {
    out.fieldErrors = Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, translateMessage(v, locale)]));
  }
  return out;
}

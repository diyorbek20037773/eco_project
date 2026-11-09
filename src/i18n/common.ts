// Umumiy UI lug‘ati (uz / ru / en): forma holatlari, xato/bo‘sh holatlar, toast, rasm yuklash,
// ulashish, not-found/error sahifalari. O‘zbekcha matnlar — asl (E2E testlar shunga tayanadi).
import { formatDayLabelL, formatTime } from "@/lib/format";
import type { Locale } from "./config";

const uz = {
  ui: {
    sending: "Yuborilmoqda…",
    loading: "Yuklanmoqda…",
    loadingTrip: "Reys yuklanmoqda…",
  },
  field: {
    optional: "(ixtiyoriy)",
    kg: "kg",
    som: "so‘m",
    kgPlaceholder: "0,0",
  },
  form: {
    saved: "Saqlandi.",
    networkError: "Internet aloqasi yo‘q. Ma’lumotlar saqlandi — «Qayta yuborish»ni bosing.",
    serverUnreachable: "Server javob bermadi. Ma’lumotlar saqlandi — biroz kutib «Qayta yuborish»ni bosing.",
    draftTitle: "Oldin kiritilgan ma’lumotlar saqlangan",
    draftRestore: "Tiklash",
    draftDiscard: "O‘chirish",
    draftSavedAt: "Saqlangan vaqti: {time}",
    notSent: "Yuborilmadi",
    resend: "Qayta yuborish",
    notSaved: "Saqlanmadi",
  },
  upload: {
    optional: "(ixtiyoriy)",
    take: "Suratga olish",
    retake: "Qayta suratga olish",
    gallery: "Galereyadan tanlash",
    remove: "Rasmni olib tashlash",
    uploading: "Rasm yuklanmoqda…",
    uploaded: "✓ Rasm yuklandi",
    retry: "Qayta yuklash",
    previewAlt: "Tanlangan rasm",
    errNetwork: "Rasm yuklanmadi: internet aloqasini tekshiring va «Qayta yuklash»ni bosing.",
    errType: "Faqat rasm (JPEG, PNG yoki WebP) yuklash mumkin.",
    errSize: "Rasm 5 MB dan katta. Kichikroq rasm tanlang yoki kamera sifatini pasaytiring.",
  },
  error: {
    title: "Sahifani ochib bo‘lmadi",
    offline: "Internet aloqasi yo‘q. Aloqa tiklangach «Qayta urinish»ni bosing.",
    server: "Server bilan bog‘lanishda xato yuz berdi. Kiritilgan ma’lumotlar yo‘qolmaydi — «Qayta urinish»ni bosing.",
    code: "Xato kodi: {code}",
    retry: "Qayta urinish",
    home: "Bosh sahifaga",
  },
  notFound: {
    metaTitle: "Sahifa topilmadi",
    title: "Sahifa topilmadi",
    body: "Bunday sahifa yo‘q yoki uni ko‘rishga ruxsatingiz yo‘q. Havolani tekshiring yoki bosh sahifaga qayting.",
    home: "Bosh sahifaga",
  },
  globalError: {
    docTitle: "Xato · Eco Point",
    title: "Ilovani ochib bo‘lmadi",
    body: "Kutilmagan xato yuz berdi. Internet aloqasini tekshiring va «Qayta urinish»ni bosing.",
    retry: "Qayta urinish",
  },
  toast: {
    close: "Xabarni yopish",
  },
  share: {
    telegram: "Telegram’da ulashish",
    copy: "Havolani nusxalash",
    copied: "Havola nusxalandi.",
    copyFailed: "Nusxalab bo‘lmadi. Havola: {url}",
    hint: "Havola faqat tizimga kirgan operatorga ochiladi.",
  },
  thumbs: {
    label: "Rasmlar",
    openFull: "— to‘liq o‘lchamda ochish",
  },
  header: {
    home: "Eco Point — bosh sahifa",
  },
};

export type CommonDict = typeof uz;

const ru: CommonDict = {
  ui: {
    sending: "Отправляем…",
    loading: "Загрузка…",
    loadingTrip: "Загружаем рейс…",
  },
  field: {
    optional: "(необязательно)",
    kg: "кг",
    som: "сум",
    kgPlaceholder: "0,0",
  },
  form: {
    saved: "Сохранено.",
    networkError: "Нет связи с интернетом. Данные сохранены — нажмите «Отправить снова».",
    serverUnreachable: "Сервер не ответил. Данные сохранены — подождите немного и нажмите «Отправить снова».",
    draftTitle: "Ранее введённые данные сохранены",
    draftRestore: "Восстановить",
    draftDiscard: "Удалить",
    draftSavedAt: "Сохранено: {time}",
    notSent: "Не отправлено",
    resend: "Отправить снова",
    notSaved: "Не сохранено",
  },
  upload: {
    optional: "(необязательно)",
    take: "Сфотографировать",
    retake: "Переснять",
    gallery: "Выбрать из галереи",
    remove: "Убрать фото",
    uploading: "Загружаем фото…",
    uploaded: "✓ Фото загружено",
    retry: "Загрузить снова",
    previewAlt: "Выбранное фото",
    errNetwork: "Фото не загрузилось: проверьте интернет и нажмите «Загрузить снова».",
    errType: "Можно загрузить только фото (JPEG, PNG или WebP).",
    errSize: "Фото больше 5 МБ. Выберите фото поменьше или снизьте качество камеры.",
  },
  error: {
    title: "Не удалось открыть страницу",
    offline: "Нет связи с интернетом. Когда связь появится, нажмите «Повторить».",
    server: "Ошибка связи с сервером. Введённые данные не пропадут — нажмите «Повторить».",
    code: "Код ошибки: {code}",
    retry: "Повторить",
    home: "На главную",
  },
  notFound: {
    metaTitle: "Страница не найдена",
    title: "Страница не найдена",
    body: "Такой страницы нет или у вас нет к ней доступа. Проверьте ссылку или вернитесь на главную.",
    home: "На главную",
  },
  globalError: {
    docTitle: "Ошибка · Eco Point",
    title: "Не удалось открыть приложение",
    body: "Произошла непредвиденная ошибка. Проверьте интернет и нажмите «Повторить».",
    retry: "Повторить",
  },
  toast: {
    close: "Закрыть сообщение",
  },
  share: {
    telegram: "Поделиться в Telegram",
    copy: "Копировать ссылку",
    copied: "Ссылка скопирована.",
    copyFailed: "Не удалось скопировать. Ссылка: {url}",
    hint: "Ссылка откроется только у оператора, вошедшего в систему.",
  },
  thumbs: {
    label: "Фото",
    openFull: "— открыть в полном размере",
  },
  header: {
    home: "Eco Point — главная",
  },
};

const en: CommonDict = {
  ui: {
    sending: "Sending…",
    loading: "Loading…",
    loadingTrip: "Loading trip…",
  },
  field: {
    optional: "(optional)",
    kg: "kg",
    som: "UZS",
    kgPlaceholder: "0.0",
  },
  form: {
    saved: "Saved.",
    networkError: "No internet connection. Your data is saved — tap “Send again”.",
    serverUnreachable: "The server didn’t respond. Your data is saved — wait a moment and tap “Send again”.",
    draftTitle: "Previously entered data was saved",
    draftRestore: "Restore",
    draftDiscard: "Discard",
    draftSavedAt: "Saved: {time}",
    notSent: "Not sent",
    resend: "Send again",
    notSaved: "Not saved",
  },
  upload: {
    optional: "(optional)",
    take: "Take photo",
    retake: "Retake photo",
    gallery: "Choose from gallery",
    remove: "Remove photo",
    uploading: "Uploading photo…",
    uploaded: "✓ Photo uploaded",
    retry: "Upload again",
    previewAlt: "Selected photo",
    errNetwork: "Photo not uploaded: check your connection and tap “Upload again”.",
    errType: "Only images (JPEG, PNG or WebP) can be uploaded.",
    errSize: "The photo is larger than 5 MB. Choose a smaller one or lower the camera quality.",
  },
  error: {
    title: "Couldn’t open the page",
    offline: "No internet connection. Tap “Try again” once you’re back online.",
    server: "Couldn’t reach the server. Entered data won’t be lost — tap “Try again”.",
    code: "Error code: {code}",
    retry: "Try again",
    home: "Go home",
  },
  notFound: {
    metaTitle: "Page not found",
    title: "Page not found",
    body: "This page doesn’t exist or you don’t have access to it. Check the link or go back home.",
    home: "Go home",
  },
  globalError: {
    docTitle: "Error · Eco Point",
    title: "Couldn’t open the app",
    body: "Something went wrong. Check your connection and tap “Try again”.",
    retry: "Try again",
  },
  toast: {
    close: "Dismiss message",
  },
  share: {
    telegram: "Share on Telegram",
    copy: "Copy link",
    copied: "Link copied.",
    copyFailed: "Couldn’t copy. Link: {url}",
    hint: "The link only opens for a signed-in operator.",
  },
  thumbs: {
    label: "Photos",
    openFull: "— open full size",
  },
  header: {
    home: "Eco Point — home",
  },
};

export const COMMON_DICT: Record<Locale, CommonDict> = { uz, ru, en };

/** "Bugun, 14:05" / "Сегодня, 14:05" / "Today, 14:05" — `formatDateTime` ning tilga mos varianti. */
export function formatDateTimeL(d: Date, locale: Locale, now: Date = new Date()): string {
  return `${formatDayLabelL(d, locale, now)}, ${formatTime(d)}`;
}

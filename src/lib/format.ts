// Ko'rsatish formatlari. Asosiy til — o'zbek (lotin); operator dashboardi uchun ru/en ham.
// Raqamlar uchun UI'da `tabular-nums` klassi ishlatiladi.
import { utcToTashkentParts, tashkentToday, addDays } from "@/domain/time";
import type { Locale } from "@/i18n/config";

const NBSP = " ";
const MONTHS: Record<Locale, string[]> = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const DAY_WORDS: Record<Locale, { today: string; tomorrow: string; yesterday: string }> = {
  uz: { today: "Bugun", tomorrow: "Ertaga", yesterday: "Kecha" },
  ru: { today: "Сегодня", tomorrow: "Завтра", yesterday: "Вчера" },
  en: { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" },
};
const UNITS: Record<Locale, { kg: string; som: string; decimal: string; group: string }> = {
  uz: { kg: "kg", som: "so‘m", decimal: ",", group: NBSP },
  ru: { kg: "кг", som: "сум", decimal: ",", group: NBSP },
  en: { kg: "kg", som: "UZS", decimal: ".", group: "," },
};

function group(n: number, sep: string = NBSP): string {
  const sign = n < 0 ? "−" : "";
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** 705000 → "705 000 so'm" (ru: "705 000 сум", en: "705,000 UZS") */
export function formatSomL(amount: number, locale: Locale): string {
  const u = UNITS[locale];
  return `${group(amount, u.group)}${NBSP}${u.som}`;
}

/** 470000 g → "470 kg"; 12500 g → "12,5 kg" (en: "12.5 kg", ru: "12,5 кг") */
export function formatKgL(grams: number, locale: Locale): string {
  const u = UNITS[locale];
  const sign = grams < 0 ? "−" : "";
  const abs = Math.abs(grams);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${sign}${group(whole, u.group)}${frac ? u.decimal + frac : ""}${NBSP}${u.kg}`;
}

export function formatDateL(d: Date, locale: Locale): string {
  const { date } = utcToTashkentParts(d);
  const [, m, day] = date.split("-");
  const month = MONTHS[locale][Number(m) - 1];
  if (locale === "en") return `${month} ${Number(day)}`;
  if (locale === "ru") return `${Number(day)} ${month}`;
  return `${Number(day)}-${month}`;
}

/** "Bugun" / "Сегодня" / "Today", ertaga, kecha yoki sana */
export function formatDayLabelL(d: Date, locale: Locale, now: Date = new Date()): string {
  const { date } = utcToTashkentParts(d);
  const today = tashkentToday(now);
  const w = DAY_WORDS[locale];
  if (date === today) return w.today;
  if (date === addDays(today, 1)) return w.tomorrow;
  if (date === addDays(today, -1)) return w.yesterday;
  return formatDateL(d, locale);
}

export function formatTime(d: Date): string {
  return utcToTashkentParts(d).time;
}

/** "Bugun, 14:00–16:00" */
export function formatWindowL(from: Date, to: Date, locale: Locale, now: Date = new Date()): string {
  return `${formatDayLabelL(from, locale, now)}, ${formatTime(from)}–${formatTime(to)}`;
}

// --- O'zbekcha (asosiy) qisqa nomlar: butun ilova shulardan foydalanadi ---------------
export const formatSom = (amount: number): string => formatSomL(amount, "uz");
export const formatKg = (grams: number): string => formatKgL(grams, "uz");
export const formatDate = (d: Date): string => formatDateL(d, "uz");
export const formatDayLabel = (d: Date, now: Date = new Date()): string => formatDayLabelL(d, "uz", now);
export const formatWindow = (from: Date, to: Date, now: Date = new Date()): string => formatWindowL(from, to, "uz", now);

/** gramm → input qiymati "12,5" */
export function gramsToKgInput(grams: number): string {
  return formatKg(grams).replace(/ kg$/, "").replace(/ /g, "");
}

export function formatDateTime(d: Date, now: Date = new Date()): string {
  return `${formatDayLabel(d, now)}, ${formatTime(d)}`;
}

/** "+998 90 123 45 67" → "tel:+998901234567" */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// Ko'rsatish formatlari (o'zbek lotin). Raqamlar uchun UI'da `tabular-nums` klassi ishlatiladi.
import { utcToTashkentParts, tashkentToday, addDays } from "@/domain/time";

const NBSP = " ";
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function group(n: number): string {
  const sign = n < 0 ? "−" : "";
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 705000 → "705 000 so'm" */
export function formatSom(amount: number): string {
  return `${group(amount)}${NBSP}so‘m`;
}

/** 470000 g → "470 kg"; 12500 g → "12,5 kg" */
export function formatKg(grams: number): string {
  const sign = grams < 0 ? "−" : "";
  const abs = Math.abs(grams);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${sign}${group(whole)}${frac ? "," + frac : ""}${NBSP}kg`;
}

/** gramm → input qiymati "12,5" */
export function gramsToKgInput(grams: number): string {
  return formatKg(grams).replace(/ kg$/, "").replace(/ /g, "");
}

export function formatDate(d: Date): string {
  const { date } = utcToTashkentParts(d);
  const [, m, day] = date.split("-");
  return `${Number(day)}-${MONTHS[Number(m) - 1]}`;
}

/** "Bugun", "Ertaga", "Kecha" yoki "8-noyabr" */
export function formatDayLabel(d: Date, now: Date = new Date()): string {
  const { date } = utcToTashkentParts(d);
  const today = tashkentToday(now);
  if (date === today) return "Bugun";
  if (date === addDays(today, 1)) return "Ertaga";
  if (date === addDays(today, -1)) return "Kecha";
  return formatDate(d);
}

export function formatTime(d: Date): string {
  return utcToTashkentParts(d).time;
}

/** "Bugun, 14:00–16:00" */
export function formatWindow(from: Date, to: Date, now: Date = new Date()): string {
  return `${formatDayLabel(from, now)}, ${formatTime(from)}–${formatTime(to)}`;
}

export function formatDateTime(d: Date, now: Date = new Date()): string {
  return `${formatDayLabel(d, now)}, ${formatTime(d)}`;
}

/** "+998 90 123 45 67" → "tel:+998901234567" */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

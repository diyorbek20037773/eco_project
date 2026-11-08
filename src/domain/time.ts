// Vaqt: Asia/Tashkent = UTC+5, yozgi vaqt yo'q. DB'da UTC.
export const TZ = "Asia/Tashkent";
const OFFSET_MS = 5 * 60 * 60 * 1000;

/** "2026-11-08" + "14:30" (Toshkent) → UTC Date. Noto'g'ri bo'lsa null. */
export function tashkentToUtc(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC Date → Toshkent bo'yicha { date: "YYYY-MM-DD", time: "HH:mm" } */
export function utcToTashkentParts(d: Date): { date: string; time: string } {
  const t = new Date(d.getTime() + OFFSET_MS).toISOString();
  return { date: t.slice(0, 10), time: t.slice(11, 16) };
}

/** Toshkent bo'yicha bugungi sana "YYYY-MM-DD". */
export function tashkentToday(now: Date = new Date()): string {
  return utcToTashkentParts(now).date;
}

/** Toshkent kunining [boshi, oxiri) UTC'da. */
export function tashkentDayRange(date: string): { start: Date; end: Date } {
  const start = tashkentToUtc(date, "00:00");
  if (!start) throw new RangeError(`Noto'g'ri sana: ${date}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function addDays(date: string, days: number): string {
  const { start } = tashkentDayRange(date);
  return utcToTashkentParts(new Date(start.getTime() + days * 86_400_000)).date;
}

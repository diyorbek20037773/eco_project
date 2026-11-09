import type { Locale } from "@/i18n/config";
import { formatDayLabelL, formatTime } from "@/lib/format";

/** "Bugun, 14:05" / "Сегодня, 14:05" / "Today, 14:05" — `formatDateTime` ning tilga mos varianti. */
export function formatDateTimeL(d: Date, locale: Locale, now: Date = new Date()): string {
  return `${formatDayLabelL(d, locale, now)}, ${formatTime(d)}`;
}

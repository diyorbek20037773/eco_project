import { utcToTashkentParts } from "@/domain/time";

/**
 * Reys uchun standart sana va vaqt oralig‘i (Toshkent): tanlangan buyurtmalarning eng erta
 * tayyor vaqti va o‘sha kundagi eng kech tugashi. O‘tgan kun bo‘lsa — bugun 09:00 dan.
 */
export function defaultTripWindow(selected: { readyFrom: Date; readyTo: Date }[], today: string): { date: string; fromTime: string; toTime: string } {
  if (selected.length === 0) return { date: today, fromTime: "09:00", toTime: "18:00" };
  const froms = selected.map((s) => utcToTashkentParts(s.readyFrom));
  const tos = selected.map((s) => utcToTashkentParts(s.readyTo));
  const earliest = froms.reduce((a, b) => (`${b.date} ${b.time}` < `${a.date} ${a.time}` ? b : a));
  const latestTo = tos.filter((t) => t.date === earliest.date).reduce((a, b) => (b.time > a.time ? b : a), { date: earliest.date, time: "00:00" });
  const date = earliest.date < today ? today : earliest.date;
  const fromTime = earliest.date < today ? "09:00" : earliest.time;
  const toTime = latestTo.time > fromTime ? latestTo.time : fromTime < "18:00" ? "18:00" : "23:59";
  return { date, fromTime, toTime };
}

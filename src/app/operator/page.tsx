import type { Metadata } from "next";
import Link from "next/link";
import type { OperatorQueue } from "@/server/contract";
import { getQueue } from "@/server/queries/operator";
import { addDays, tashkentToday } from "@/domain/time";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { inputClasses } from "@/components/ui/styles";
import { cx } from "@/components/ui/cx";
import { QueueBoard } from "@/components/operator/QueueBoard";

export const metadata: Metadata = { title: "Navbat" };

function first(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x && x.trim() ? x.trim() : undefined;
}

export default async function OperatorQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawDate = first(sp.date);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  const district = first(sp.district);
  const queue: OperatorQueue = await getQueue({ date, district });
  const today = tashkentToday();
  const tomorrow = addDays(today, 1);

  const qs = (d?: string) => {
    const p = new URLSearchParams();
    if (d) p.set("date", d);
    if (district) p.set("district", district);
    const s = p.toString();
    return s ? `${routes.operator.queue}?${s}` : routes.operator.queue;
  };
  const chip = (active: boolean) =>
    cx(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
      active ? "border-primary bg-primary text-white" : "border-line-strong bg-surface hover:bg-primary-soft",
    );

  return (
    <div className="space-y-4">
      <PageTitle sub="Buyurtmalarni belgilang, tartibni tuzing va reysga aylantiring.">Navbat</PageTitle>

      <form method="get" action={routes.operator.queue} className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-3" aria-label="Navbat filtri">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tezkor sana">
          <Link href={qs(undefined)} className={chip(!date)} aria-current={!date ? "true" : undefined}>
            Barcha ochiq
          </Link>
          <Link href={qs(today)} className={chip(date === today)} aria-current={date === today ? "true" : undefined}>
            Bugun
          </Link>
          <Link href={qs(tomorrow)} className={chip(date === tomorrow)} aria-current={date === tomorrow ? "true" : undefined}>
            Ertaga
          </Link>
        </div>
        <div className="min-w-0">
          <label htmlFor="q-date" className="mb-1 block text-sm font-semibold">
            Sana
          </label>
          <input id="q-date" name="date" type="date" defaultValue={date ?? ""} className={cx(inputClasses(), "w-44")} />
        </div>
        <div className="min-w-0">
          <label htmlFor="q-district" className="mb-1 block text-sm font-semibold">
            Hudud
          </label>
          <select id="q-district" name="district" defaultValue={district ?? ""} className={cx(inputClasses(), "w-48")}>
            <option value="">Barcha hududlar</option>
            {queue.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Ko‘rsatish
        </button>
      </form>

      {queue.items.length === 0 ? (
        <EmptyState title="Navbat bo‘sh">
          {date || district
            ? "Tanlangan sana yoki hudud bo‘yicha ochiq buyurtma yo‘q. Filtrni o‘zgartiring yoki «Barcha ochiq»ni tanlang."
            : "Do‘konlar «Olib keting» yuborganda buyurtmalar shu yerda chiqadi."}
        </EmptyState>
      ) : (
        <QueueBoard key={`${date ?? ""}|${district ?? ""}`} items={queue.items} />
      )}
    </div>
  );
}

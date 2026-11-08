import type { Metadata } from "next";
import Link from "next/link";
import type { OperatorDashboardCounts, OperatorQueue, TripBuilderOptions } from "@/server/contract";
import { getOperatorCounts, getQueue, getTripBuilderOptions } from "@/server/queries/operator";
import { addDays, tashkentToday } from "@/domain/time";
import { routes } from "@/lib/routes";
import { EmptyState } from "@/components/ui/States";
import { IconCard, IconChat, IconInbox } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { QueueBoard } from "@/components/operator/QueueBoard";
import { QueueFilters } from "@/components/operator/QueueFilters";

export const metadata: Metadata = { title: "Buyurtmalar navbati" };

function first(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x && x.trim() ? x.trim() : undefined;
}

function Counters({ counts }: { counts: OperatorDashboardCounts }) {
  const cells = [
    { label: "Qabul kutilmoqda", value: counts.awaitingAcceptance, icon: <IconInbox size={30} />, href: `${routes.operator.trips}?status=COLLECTED`, alert: false },
    { label: "To‘lov kutilmoqda", value: counts.awaitingPayment, icon: <IconCard size={30} className="text-mint-hover" />, href: `${routes.operator.trips}?status=AWAITING_PAYMENT`, alert: false },
    { label: "Ochiq bahslar", value: counts.openDisputes, icon: <IconChat size={30} />, href: `${routes.operator.trips}?status=ACTIVE`, alert: counts.openDisputes > 0 },
  ];
  return (
    <section aria-label="Reyslar holati" className="grid rounded-2xl border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-line">
      {cells.map((c) => (
        <Link key={c.label} href={c.href} className="flex min-h-20 items-center gap-4 rounded-2xl px-5 py-3 hover:bg-canvas">
          <span aria-hidden="true" className={cx("shrink-0", c.alert ? "text-danger" : "text-ink")}>
            {c.icon}
          </span>
          <span className="min-w-0">
            <span className={cx("block", c.alert ? "font-semibold text-danger" : "text-ink")}>
              {c.alert ? "⚠ " : ""}
              {c.label}
            </span>
            <span className="block text-3xl font-bold leading-tight tabular-nums">{c.value}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

export default async function OperatorQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawDate = first(sp.date);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  const district = first(sp.district);
  const [queue, options, counts]: [OperatorQueue, TripBuilderOptions, OperatorDashboardCounts] = await Promise.all([
    getQueue({ date, district }),
    getTripBuilderOptions([]),
    getOperatorCounts(),
  ]);
  const today = tashkentToday();
  const tomorrow = addDays(today, 1);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">Buyurtmalar navbati</h1>

      <QueueFilters date={date} district={district} districts={queue.districts} today={today} tomorrow={tomorrow} />

      {queue.items.length === 0 ? (
        <div className="space-y-6">
          <EmptyState title="Navbat bo‘sh">
            {date || district
              ? "Tanlangan sana yoki hudud bo‘yicha ochiq buyurtma yo‘q. Filtrni o‘zgartiring yoki «Barcha ochiq»ni tanlang."
              : "Do‘konlar «Olib keting» yuborganda buyurtmalar shu yerda chiqadi."}
          </EmptyState>
          <Counters counts={counts} />
        </div>
      ) : (
        <QueueBoard
          key={`${date ?? ""}|${district ?? ""}`}
          items={queue.items}
          collectors={options.collectors}
          buyers={options.buyers}
          tariff={options.currentTariff}
          today={today}
          footer={<Counters counts={counts} />}
        />
      )}
    </div>
  );
}

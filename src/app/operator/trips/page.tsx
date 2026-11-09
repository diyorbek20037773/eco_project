import type { Metadata } from "next";
import Link from "next/link";
import type { TripListItem, TripStatus } from "@/server/contract";
import { getTrips } from "@/server/queries/operator";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { labelsFor } from "@/i18n/labels";
import { OPERATOR_DICT } from "@/i18n/operator";
import { formatKgL, formatSomL, formatWindowL } from "@/lib/format";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { DisputeFlag, StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronRight, IconList } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

export async function generateMetadata(): Promise<Metadata> {
  return { title: OPERATOR_DICT[await getLocale()].tripsList.metaTitle };
}

const STATUSES: TripStatus[] = ["PLANNED", "IN_PROGRESS", "COLLECTED", "ACCEPTED", "AWAITING_PAYMENT", "CLOSED", "CANCELLED"];
type Filter = TripStatus | "ACTIVE" | "ALL";

function parseFilter(v: string | string[] | undefined): Filter {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === "ALL" || x === "ACTIVE") return x;
  return STATUSES.includes(x as TripStatus) ? (x as TripStatus) : "ACTIVE";
}

export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = parseFilter(sp.status);
  const [trips, locale]: [TripListItem[], Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getTrips({ status }), getLocale()]);
  const d = OPERATOR_DICT[locale];
  const t = d.tripsList;
  const statusLabel = labelsFor(locale).tripStatus;
  const kg = (g: number) => formatKgL(g, locale);
  const som = (n: number) => formatSomL(n, locale);

  const filters: { key: Filter; label: string }[] = [
    { key: "ACTIVE", label: t.filterActive },
    { key: "ALL", label: t.filterAll },
    ...STATUSES.map((s) => ({ key: s as Filter, label: statusLabel[s] })),
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        sub={t.sub}
        actions={
          <LinkButton href={routes.operator.queue} variant="secondary" icon={<IconList />}>
            {t.buildFromQueue}
          </LinkButton>
        }
      >
        {d.common.trips}
      </PageTitle>

      <nav aria-label={t.filterNav} className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`${routes.operator.trips}?status=${f.key}`}
            aria-current={status === f.key ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
              status === f.key ? "border-primary bg-primary text-white" : "border-line-strong bg-surface hover:bg-primary-soft",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {trips.length === 0 ? (
        <EmptyState title={t.emptyTitle} action={<LinkButton href={routes.operator.queue}>{d.common.toQueue}</LinkButton>}>
          {status === "ACTIVE" ? t.emptyActive : t.emptyStatus}
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{t.caption}</caption>
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">{t.colTrip}</th>
                  <th scope="col" className="px-3 py-2">{t.colStatus}</th>
                  <th scope="col" className="px-3 py-2">{t.colTime}</th>
                  <th scope="col" className="px-3 py-2">{t.colPeople}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t.colStops}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t.colDelivered}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t.colAccepted}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t.colRemaining}</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((tr) => (
                  <tr key={tr.id} className="border-t border-line align-top hover:bg-canvas">
                    <td className="px-3 py-2">
                      <Link href={routes.operator.trip(tr.id)} className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
                        №{tr.number}
                      </Link>
                    </td>
                    <td className="space-y-1 px-3 py-3">
                      <StatusBadge kind="trip" value={tr.status} />
                      {tr.openDisputes > 0 ? <DisputeFlag>{fmt(t.disputes, { n: tr.openDisputes })}</DisputeFlag> : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatWindowL(tr.windowStart, tr.windowEnd, locale)}</td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold">{tr.collectorName}</span>
                      <span className="block text-muted">{tr.buyerName}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {tr.doneCount}/{tr.stopCount}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{kg(tr.deliveredGrams)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{tr.acceptedGrams === null ? "—" : kg(tr.acceptedGrams)}</td>
                    <td className={cx("px-3 py-3 text-right font-semibold tabular-nums", tr.remainingToPay !== 0 && "text-amber")}>
                      {som(tr.remainingToPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {trips.map((tr) => (
              <li key={tr.id}>
                <Link href={routes.operator.trip(tr.id)} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 hover:border-primary">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{fmt(d.common.tripNo, { n: tr.number })}</span>
                      <StatusBadge kind="trip" value={tr.status} />
                      {tr.openDisputes > 0 ? <DisputeFlag>{fmt(t.disputes, { n: tr.openDisputes })}</DisputeFlag> : null}
                    </span>
                    <span className="block text-sm tabular-nums">{formatWindowL(tr.windowStart, tr.windowEnd, locale)}</span>
                    <span className="block text-sm text-muted">
                      {tr.collectorName} → {tr.buyerName}
                    </span>
                    <span className="block text-sm tabular-nums">
                      {fmt(t.mobileStops, { done: tr.doneCount, total: tr.stopCount, kg: kg(tr.deliveredGrams) })}
                      {tr.acceptedGrams !== null ? fmt(t.mobileAccepted, { kg: kg(tr.acceptedGrams) }) : ""}
                    </span>
                    {tr.remainingToPay !== 0 ? (
                      <span className="block text-sm font-semibold text-amber tabular-nums">{fmt(t.mobileRemaining, { sum: som(tr.remainingToPay) })}</span>
                    ) : null}
                  </span>
                  <IconChevronRight className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

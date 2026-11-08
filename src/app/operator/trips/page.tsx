import type { Metadata } from "next";
import Link from "next/link";
import type { TripListItem, TripStatus } from "@/server/contract";
import { getTrips } from "@/server/queries/operator";
import { TRIP_STATUS_LABEL } from "@/domain/labels";
import { formatKg, formatSom, formatWindow } from "@/lib/format";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { DisputeFlag, StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronRight, IconList } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

export const metadata: Metadata = { title: "Reyslar" };

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
  const trips: TripListItem[] = await getTrips({ status });

  const filters: { key: Filter; label: string }[] = [
    { key: "ACTIVE", label: "Faol" },
    { key: "ALL", label: "Hammasi" },
    ...STATUSES.map((s) => ({ key: s as Filter, label: TRIP_STATUS_LABEL[s] })),
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        sub="Reys holati, vaznlar va to‘lov qoldig‘i"
        actions={
          <LinkButton href={routes.operator.queue} variant="secondary" icon={<IconList />}>
            Navbatdan reys tuzish
          </LinkButton>
        }
      >
        Reyslar
      </PageTitle>

      <nav aria-label="Holat bo‘yicha filtr" className="flex flex-wrap gap-2">
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
        <EmptyState title="Reys topilmadi" action={<LinkButton href={routes.operator.queue}>Navbatga o‘tish</LinkButton>}>
          {status === "ACTIVE" ? "Faol reys yo‘q. Navbatdan buyurtmalarni tanlab yangi reys tuzing." : "Bu holatdagi reys yo‘q."}
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Reyslar ro‘yxati</caption>
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Reys</th>
                  <th scope="col" className="px-3 py-2">Holat</th>
                  <th scope="col" className="px-3 py-2">Vaqt</th>
                  <th scope="col" className="px-3 py-2">Yig‘uvchi / xaridor</th>
                  <th scope="col" className="px-3 py-2 text-right">Bekat</th>
                  <th scope="col" className="px-3 py-2 text-right">Topshirildi</th>
                  <th scope="col" className="px-3 py-2 text-right">Qabul</th>
                  <th scope="col" className="px-3 py-2 text-right">To‘lov qoldig‘i</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id} className="border-t border-line align-top hover:bg-canvas">
                    <td className="px-3 py-2">
                      <Link href={routes.operator.trip(t.id)} className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
                        №{t.number}
                      </Link>
                    </td>
                    <td className="space-y-1 px-3 py-3">
                      <StatusBadge kind="trip" value={t.status} />
                      {t.openDisputes > 0 ? <DisputeFlag>Bahs: {t.openDisputes}</DisputeFlag> : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatWindow(t.windowStart, t.windowEnd)}</td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold">{t.collectorName}</span>
                      <span className="block text-muted">{t.buyerName}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {t.doneCount}/{t.stopCount}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatKg(t.deliveredGrams)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.acceptedGrams === null ? "—" : formatKg(t.acceptedGrams)}</td>
                    <td className={cx("px-3 py-3 text-right font-semibold tabular-nums", t.remainingToPay !== 0 && "text-amber")}>
                      {formatSom(t.remainingToPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {trips.map((t) => (
              <li key={t.id}>
                <Link href={routes.operator.trip(t.id)} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 hover:border-primary">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">Reys №{t.number}</span>
                      <StatusBadge kind="trip" value={t.status} />
                      {t.openDisputes > 0 ? <DisputeFlag>Bahs: {t.openDisputes}</DisputeFlag> : null}
                    </span>
                    <span className="block text-sm tabular-nums">{formatWindow(t.windowStart, t.windowEnd)}</span>
                    <span className="block text-sm text-muted">
                      {t.collectorName} → {t.buyerName}
                    </span>
                    <span className="block text-sm tabular-nums">
                      {t.doneCount}/{t.stopCount} bekat · topshirildi {formatKg(t.deliveredGrams)}
                      {t.acceptedGrams !== null ? ` · qabul ${formatKg(t.acceptedGrams)}` : ""}
                    </span>
                    {t.remainingToPay !== 0 ? (
                      <span className="block text-sm font-semibold text-amber tabular-nums">To‘lov qoldig‘i: {formatSom(t.remainingToPay)}</span>
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

import type { Metadata } from "next";
import Link from "next/link";
import type { CollectorToday, CollectorTripSummary, StopDTO } from "@/server/contract";
import { getCollectorToday } from "@/server/queries/collector";
import { uzText, pointTitle } from "@/domain/labels";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { labelsFor } from "@/i18n/labels";
import { SHOP_DICT, type ShopDict } from "@/i18n/shop";
import type { Locale } from "@/i18n/config";
import { formatKgL, formatTime, formatWindowL, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, Section } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { LateBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Thumbs } from "@/components/ui/Thumbs";
import { IconChevronRight, IconMapPin, IconPhone, IconScale, IconTruck } from "@/components/ui/icons";
import { StopList } from "@/components/collector/StopList";
import { DisputeAck } from "@/components/disputes/DisputeAck";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.collectorToday };
}

function orderedPending(trip: CollectorTripSummary): StopDTO[] {
  return trip.stops.filter((s) => s.status === "PENDING").sort((a, b) => a.sequence - b.sequence);
}

export default async function CollectorTodayPage() {
  const [data, locale]: [CollectorToday, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getCollectorToday(), getLocale()]);
  const t = SHOP_DICT[locale];
  const d = t.today;
  const L = labelsFor(locale);
  const now = new Date();
  const active = data.trips.find((t) => t.nextStopId !== null) ?? data.trips[0] ?? null;
  const otherTrips = data.trips.filter((t) => t.id !== active?.id);
  const pending = active ? orderedPending(active) : [];
  const current = active ? (active.stops.find((s) => s.id === active.nextStopId) ?? pending[0] ?? null) : null;
  const after = current ? (pending.find((s) => s.sequence > current.sequence) ?? null) : null;

  return (
    <div className={active ? "space-y-6 pb-28" : "space-y-6"}>
      <h1 className="sr-only">{d.title}</h1>

      {data.disputesAwaitingAck.length > 0 ? (
        <Section id="disputes" title={d.disputesTitle} description={d.disputesDesc}>
          <ul className="space-y-3">
            {data.disputesAwaitingAck.map((x) => (
              <li key={x.id}>
                <DisputeAck dispute={x} context={`${fmt(t.c.tripNo, { n: x.tripNumber })} · ${x.pointName}`} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {!active ? (
        <EmptyState title={d.emptyTitle} icon={<IconTruck size={32} />}>
          {d.emptyBody}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={routes.collector.trip(active.id)} className="inline-flex min-h-11 items-center gap-1 font-bold underline-offset-4 hover:underline">
              {fmt(t.c.tripNo, { n: active.number })} · {formatWindowL(active.windowStart, active.windowEnd, locale)}
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="trip" value={active.status} />
              {current && active.windowEnd.getTime() < now.getTime() ? <LateBadge /> : null}
            </span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm font-semibold tabular-nums">
              <span>{d.done}</span>
              <span>
                {active.doneCount}/{active.totalCount}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={d.progress}
              aria-valuemin={0}
              aria-valuemax={active.totalCount}
              aria-valuenow={active.doneCount}
              className="h-2.5 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${active.totalCount ? (active.doneCount / active.totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {current ? (
            <Card as="section" className="space-y-3 border-2 border-primary" aria-labelledby="next-stop-title">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                {fmt(d.nextStop, { n: current.sequence, total: active.totalCount })}
              </p>
              <h2 id="next-stop-title" className="text-lg font-bold">
                {pointTitle(current.point)}
              </h2>
              <p className="flex items-start gap-2 text-2xl font-bold leading-snug sm:text-3xl">
                <IconMapPin size={26} className="mt-1 shrink-0 text-primary" />
                <span className="min-w-0">{current.point.address}</span>
              </p>
              {current.point.landmark ? (
                <p>
                  <span className="font-semibold">{d.landmark}</span> {current.point.landmark}
                </p>
              ) : null}
              <p className="text-lg tabular-nums">
                <span className="font-semibold">{d.ready}</span> {formatTime(current.request.readyFrom)}–{formatTime(current.request.readyTo)}
              </p>
              <p>
                <span className="font-semibold">{d.contact}</span> {current.point.contactName ?? "—"} ·{" "}
                <span className="tabular-nums">{current.point.contactPhone}</span>
              </p>
              <LinkButton href={telHref(current.point.contactPhone)} size="xl" block icon={<IconPhone size={24} />}>
                {t.c.call}
              </LinkButton>
              <p className="text-sm">
                <span className="font-semibold">{d.approx}</span>{" "}
                {current.request.estimatedGrams !== null
                  ? formatKgL(current.request.estimatedGrams, locale)
                  : current.request.volume
                    ? L.volume[current.request.volume]
                    : d.notGiven}
              </p>
              {current.request.note ? (
                <p className="rounded-lg bg-kraft-soft p-2 text-sm">
                  <span className="font-semibold">{d.note}</span> {uzText(current.request.note)}
                </p>
              ) : null}
              <Thumbs items={current.request.photos} label={t.c.cartonPhotos} />
              <p className="border-t border-line pt-2 text-sm text-muted">
                {after ? (
                  <>
                    {d.then} <span className="font-semibold text-ink">{after.point.shopName}</span> — {after.point.address}
                  </>
                ) : (
                  <>
                    {d.then} {d.buyerDash} <span className="font-semibold text-ink">{active.buyer.name}</span>
                    {active.buyer.address ? `, ${active.buyer.address}` : ""}
                  </>
                )}
              </p>
            </Card>
          ) : (
            <Card tone="primary" className="space-y-2">
              <p className="text-xl font-bold">{d.allDoneTitle}</p>
              <p>
                {d.collected} <span className="font-bold tabular-nums">{formatKgL(active.collectedGrams, locale)}</span>. {d.handOver}{" "}
                <span className="font-semibold">{active.buyer.name}</span>
                {active.buyer.address ? `, ${active.buyer.address}` : ""}.
              </p>
              {active.buyer.phone ? (
                <LinkButton href={telHref(active.buyer.phone)} variant="secondary" icon={<IconPhone />}>
                  {d.callBuyer}
                </LinkButton>
              ) : null}
            </Card>
          )}

          <Section id="stops" title={d.allStops}>
            <StopList stops={active.stops} currentId={current?.id ?? null} />
          </Section>

          <StickyActionBar>
            {current ? (
              <LinkButton href={routes.collector.stop(current.id)} size="lg" block className="min-h-14" icon={<IconScale />}>
                {d.enterWeighing}
              </LinkButton>
            ) : (
              <LinkButton href={routes.collector.trip(active.id)} size="lg" block className="min-h-14" icon={<IconChevronRight />}>
                {d.tripDetails}
              </LinkButton>
            )}
          </StickyActionBar>
        </>
      )}

      {otherTrips.length > 0 ? (
        <Section id="other" title={d.otherTrips}>
          <TripLinks trips={otherTrips} t={t} locale={locale} />
        </Section>
      ) : null}

      <Section id="upcoming" title={d.upcoming}>
        {data.upcoming.length > 0 ? <TripLinks trips={data.upcoming} t={t} locale={locale} /> : <p className="text-muted">{d.noUpcoming}</p>}
      </Section>
    </div>
  );
}

function TripLinks({ trips, t, locale }: { trips: CollectorTripSummary[]; t: ShopDict; locale: Locale }) {
  return (
    <ul className="space-y-2">
      {trips.map((tr) => (
        <li key={tr.id}>
          <Link
            href={routes.collector.trip(tr.id)}
            className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-3 hover:border-primary"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {fmt(t.c.tripNo, { n: tr.number })} · {formatWindowL(tr.windowStart, tr.windowEnd, locale)}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                <StatusBadge kind="trip" value={tr.status} />
                <span className="tabular-nums">
                  {fmt(t.today.stopsCount, { done: tr.doneCount, total: tr.totalCount })}
                </span>
              </span>
            </span>
            <IconChevronRight className="shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

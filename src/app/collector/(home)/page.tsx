import type { Metadata } from "next";
import Link from "next/link";
import type { CollectorToday, CollectorTripSummary, StopDTO } from "@/server/contract";
import { getCollectorToday } from "@/server/queries/collector";
import { VOLUME_LABEL, uzText, pointTitle } from "@/domain/labels";
import { formatKg, formatTime, formatWindow, telHref } from "@/lib/format";
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

export const metadata: Metadata = { title: "Bugungi reys" };

function orderedPending(trip: CollectorTripSummary): StopDTO[] {
  return trip.stops.filter((s) => s.status === "PENDING").sort((a, b) => a.sequence - b.sequence);
}

export default async function CollectorTodayPage() {
  const data: CollectorToday = await getCollectorToday();
  const now = new Date();
  const active = data.trips.find((t) => t.nextStopId !== null) ?? data.trips[0] ?? null;
  const otherTrips = data.trips.filter((t) => t.id !== active?.id);
  const pending = active ? orderedPending(active) : [];
  const current = active ? (active.stops.find((s) => s.id === active.nextStopId) ?? pending[0] ?? null) : null;
  const after = current ? (pending.find((s) => s.sequence > current.sequence) ?? null) : null;

  return (
    <div className={active ? "space-y-6 pb-28" : "space-y-6"}>
      <h1 className="sr-only">Bugungi reys</h1>

      {data.disputesAwaitingAck.length > 0 ? (
        <Section id="disputes" title="Bahs qarorlari" description="Operator qaror chiqardi — roziligingizni bildiring.">
          <ul className="space-y-3">
            {data.disputesAwaitingAck.map((d) => (
              <li key={d.id}>
                <DisputeAck dispute={d} context={`Reys №${d.tripNumber} · ${d.pointName}`} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {!active ? (
        <EmptyState title="Bugun reys yo‘q" icon={<IconTruck size={32} />}>
          Operator reys biriktirganda u shu yerda chiqadi. Sahifani keyinroq yangilang.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={routes.collector.trip(active.id)} className="inline-flex min-h-11 items-center gap-1 font-bold underline-offset-4 hover:underline">
              Reys №{active.number} · {formatWindow(active.windowStart, active.windowEnd)}
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="trip" value={active.status} />
              {current && active.windowEnd.getTime() < now.getTime() ? <LateBadge /> : null}
            </span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm font-semibold tabular-nums">
              <span>Bajarildi</span>
              <span>
                {active.doneCount}/{active.totalCount}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Reys bajarilishi"
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
                Navbatdagi nuqta · {current.sequence}/{active.totalCount}
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
                  <span className="font-semibold">Mo‘ljal:</span> {current.point.landmark}
                </p>
              ) : null}
              <p className="text-lg tabular-nums">
                <span className="font-semibold">Tayyor:</span> {formatTime(current.request.readyFrom)}–{formatTime(current.request.readyTo)}
              </p>
              <p>
                <span className="font-semibold">Kontakt:</span> {current.point.contactName ?? "—"} ·{" "}
                <span className="tabular-nums">{current.point.contactPhone}</span>
              </p>
              <LinkButton href={telHref(current.point.contactPhone)} size="xl" block icon={<IconPhone size={24} />}>
                Qo‘ng‘iroq qilish
              </LinkButton>
              <p className="text-sm">
                <span className="font-semibold">Taxminan:</span>{" "}
                {current.request.estimatedGrams !== null
                  ? formatKg(current.request.estimatedGrams)
                  : current.request.volume
                    ? VOLUME_LABEL[current.request.volume]
                    : "ko‘rsatilmagan"}
              </p>
              {current.request.note ? (
                <p className="rounded-lg bg-kraft-soft p-2 text-sm">
                  <span className="font-semibold">Izoh:</span> {uzText(current.request.note)}
                </p>
              ) : null}
              <Thumbs items={current.request.photos} label="Karton rasmlari" />
              <p className="border-t border-line pt-2 text-sm text-muted">
                {after ? (
                  <>
                    Keyin: <span className="font-semibold text-ink">{after.point.shopName}</span> — {after.point.address}
                  </>
                ) : (
                  <>
                    Keyin: xaridor — <span className="font-semibold text-ink">{active.buyer.name}</span>
                    {active.buyer.address ? `, ${active.buyer.address}` : ""}
                  </>
                )}
              </p>
            </Card>
          ) : (
            <Card tone="primary" className="space-y-2">
              <p className="text-xl font-bold">Barcha nuqtalar bajarildi</p>
              <p>
                Yig‘ildi: <span className="font-bold tabular-nums">{formatKg(active.collectedGrams)}</span>. Kartonni xaridorga topshiring:{" "}
                <span className="font-semibold">{active.buyer.name}</span>
                {active.buyer.address ? `, ${active.buyer.address}` : ""}.
              </p>
              {active.buyer.phone ? (
                <LinkButton href={telHref(active.buyer.phone)} variant="secondary" icon={<IconPhone />}>
                  Xaridorga qo‘ng‘iroq
                </LinkButton>
              ) : null}
            </Card>
          )}

          <Section id="stops" title="Barcha nuqtalar">
            <StopList stops={active.stops} currentId={current?.id ?? null} />
          </Section>

          <StickyActionBar>
            {current ? (
              <LinkButton href={routes.collector.stop(current.id)} size="lg" block className="min-h-14" icon={<IconScale />}>
                Tortishni kiritish
              </LinkButton>
            ) : (
              <LinkButton href={routes.collector.trip(active.id)} size="lg" block className="min-h-14" icon={<IconChevronRight />}>
                Reys tafsilotlari
              </LinkButton>
            )}
          </StickyActionBar>
        </>
      )}

      {otherTrips.length > 0 ? (
        <Section id="other" title="Bugungi boshqa reyslar">
          <TripLinks trips={otherTrips} />
        </Section>
      ) : null}

      <Section id="upcoming" title="Keyingi kunlar">
        {data.upcoming.length > 0 ? <TripLinks trips={data.upcoming} /> : <p className="text-muted">Keyingi kunlarga reys rejalashtirilmagan.</p>}
      </Section>
    </div>
  );
}

function TripLinks({ trips }: { trips: CollectorTripSummary[] }) {
  return (
    <ul className="space-y-2">
      {trips.map((t) => (
        <li key={t.id}>
          <Link
            href={routes.collector.trip(t.id)}
            className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-3 hover:border-primary"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                Reys №{t.number} · {formatWindow(t.windowStart, t.windowEnd)}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                <StatusBadge kind="trip" value={t.status} />
                <span className="tabular-nums">
                  {t.doneCount}/{t.totalCount} nuqta
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

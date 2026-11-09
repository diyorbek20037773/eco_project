import type { Metadata } from "next";
import type { CollectorStopDetail } from "@/server/contract";
import { getCollectorStop } from "@/server/queries/collector";
import { uzText, pointTitle } from "@/domain/labels";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { labelsFor } from "@/i18n/labels";
import { formatDateTimeL } from "@/i18n/common";
import { SHOP_DICT } from "@/i18n/shop";
import { formatKgL, formatTime, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Thumbs } from "@/components/ui/Thumbs";
import { IconChevronLeft, IconMapPin, IconPhone } from "@/components/ui/icons";
import { StopWorkflow } from "@/components/collector/StopWorkflow";
import { ConfirmationLine, DisputeSummary, WeighingSummary } from "@/components/stops/WeighingSummary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.stop };
}

export default async function CollectorStopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ stop, trip, canRecord }, locale]: [CollectorStopDetail, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getCollectorStop(id), getLocale()]);
  const t = SHOP_DICT[locale];
  const ts = t.stop;
  const L = labelsFor(locale);
  const req = stop.request;

  return (
    <div className="space-y-5">
      <TextLink href={routes.collector.trip(trip.id)}>
        <IconChevronLeft size={18} /> {fmt(t.c.tripNo, { n: trip.number })}
      </TextLink>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-muted">
            {fmt(ts.header, { n: stop.sequence, r: req.number })}
          </p>
          <StatusBadge kind="stop" value={stop.status} />
        </div>
        <h1 className="text-xl font-bold">
          {pointTitle(stop.point)}
        </h1>
        <p className="flex items-start gap-2 text-2xl font-bold leading-snug">
          <IconMapPin size={24} className="mt-1 shrink-0 text-primary" />
          <span className="min-w-0">{stop.point.address}</span>
        </p>
        {stop.point.landmark ? (
          <p>
            <span className="font-semibold">{t.today.landmark}</span> {stop.point.landmark}
          </p>
        ) : null}
        <p className="tabular-nums">
          <span className="font-semibold">{t.today.ready}</span> {formatTime(req.readyFrom)}–{formatTime(req.readyTo)} ·{" "}
          <span className="font-semibold">{t.today.approx}</span>{" "}
          {req.estimatedGrams !== null ? formatKgL(req.estimatedGrams, locale) : req.volume ? L.volume[req.volume] : t.today.notGiven}
        </p>
        {req.note ? (
          <p className="rounded-lg bg-kraft-soft p-2 text-sm">
            <span className="font-semibold">{t.today.note}</span> {uzText(req.note)}
          </p>
        ) : null}
        <Thumbs items={req.photos} label={t.c.cartonPhotos} />
        <LinkButton href={telHref(stop.point.contactPhone)} variant="secondary" size="lg" block icon={<IconPhone />}>
          {ts.callWith} <span className="whitespace-nowrap">{stop.point.contactName ?? stop.point.contactPhone}</span>
        </LinkButton>
      </div>

      {stop.weighing ? (
        <Section id="weighing" title={ts.weighingSection}>
          <Card className="space-y-3">
            <WeighingSummary weighing={stop.weighing} effectiveNetGrams={stop.effectiveNetGrams} />
            <ConfirmationLine confirmation={stop.confirmation} />
          </Card>
        </Section>
      ) : null}

      {stop.status === "SKIPPED" ? (
        <Notice tone="warning" title={ts.skippedTitle}>
          {stop.skipReason ? uzText(stop.skipReason) : ts.noReason}
          {stop.skippedAt ? ` · ${formatDateTimeL(stop.skippedAt, locale)}` : ""}
        </Notice>
      ) : null}

      {stop.disputes.length > 0 ? (
        <Section id="disputes" title={ts.disputes}>
          <ul className="space-y-2">
            {stop.disputes.map((d) => (
              <li key={d.id}>
                <DisputeSummary dispute={d} />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{ts.ackHint}</p>
        </Section>
      ) : null}

      {!canRecord && stop.status === "PENDING" ? (
        <Notice tone="info">{ts.notActive}</Notice>
      ) : null}

      <StopWorkflow key={stop.id} stopId={stop.id} tripId={trip.id} canRecord={canRecord} />
    </div>
  );
}

import type { Metadata } from "next";
import type { ShopRequestDetail } from "@/server/contract";
import { getShopRequest } from "@/server/queries/shop";
import { uzText } from "@/domain/labels";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { labelsFor } from "@/i18n/labels";
import { formatDateTimeL } from "@/i18n/common";
import { SHOP_DICT } from "@/i18n/shop";
import { formatKgL, formatWindowL, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, KeyValues, PageTitle, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Thumbs } from "@/components/ui/Thumbs";
import { IconChevronLeft, IconPhone } from "@/components/ui/icons";
import { ConfirmWeighing } from "@/components/shop/ConfirmWeighing";
import { CancelRequest } from "@/components/shop/CancelRequest";
import { ReceiptCard } from "@/components/shop/Receipt";
import { DisputeAck } from "@/components/disputes/DisputeAck";
import { ConfirmationLine, DisputeSummary, WeighingSummary } from "@/components/stops/WeighingSummary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.request };
}

export default async function ShopRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const [r, locale]: [ShopRequestDetail, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getShopRequest(id), getLocale()]);
  const t = SHOP_DICT[locale];
  const tr = t.request;
  const L = labelsFor(locale);

  const weighedStop = [...r.stops].reverse().find((s) => s.weighing !== null) ?? null;
  const disputes = weighedStop?.disputes ?? [];
  const awaitingAck = disputes.filter((d) => d.status === "DECIDED" && !d.shopAckAt);
  const otherDisputes = disputes.filter((d) => !awaitingAck.includes(d));
  const history = [...r.stops].sort((a, b) => a.tripNumber - b.tripNumber || a.sequence - b.sequence);

  return (
    <div className="space-y-6">
      <TextLink href={routes.shop.home}>
        <IconChevronLeft size={18} /> {t.c.home}
      </TextLink>

      {created ? (
        <Notice tone="success" live="polite" title={fmt(tr.createdTitle, { n: r.number })}>
          {tr.createdBody}
        </Notice>
      ) : null}

      <PageTitle sub={r.point.name} actions={<StatusBadge kind="request" value={r.status} />}>
        {fmt(t.c.orderNo, { n: r.number })}
      </PageTitle>

      <Card>
        <KeyValues
          rows={[
            { label: tr.readyTime, value: formatWindowL(r.readyFrom, r.readyTo, locale) },
            { label: tr.address, value: <span className="font-normal">{r.point.address}</span> },
            {
              label: tr.estVolume,
              value: r.estimatedGrams !== null ? formatKgL(r.estimatedGrams, locale) : r.volume ? L.volume[r.volume] : tr.notGiven,
            },
            ...(r.note ? [{ label: tr.note, value: <span className="font-normal">{uzText(r.note)}</span> }] : []),
            { label: tr.sent, value: formatDateTimeL(r.createdAt, locale) },
          ]}
        />
        {r.photos.length > 0 ? (
          <div className="mt-3">
            <Thumbs items={r.photos} label={t.c.cartonPhotos} />
          </div>
        ) : null}
      </Card>

      {r.trip ? (
        <Section id="trip" title={tr.pickupSection}>
          <Card tone="primary" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{fmt(t.c.tripNo, { n: r.trip.number })}</p>
              <StatusBadge kind="trip" value={r.trip.status} />
            </div>
            <p className="text-xl font-bold tabular-nums">{formatWindowL(r.trip.windowStart, r.trip.windowEnd, locale)}</p>
            <p>
              {t.c.collector} <span className="font-semibold">{r.trip.collectorName}</span>
            </p>
            {r.trip.collectorPhone ? (
              <LinkButton href={telHref(r.trip.collectorPhone)} variant="secondary" icon={<IconPhone />}>
                {t.c.call} · <span className="whitespace-nowrap">{r.trip.collectorPhone}</span>
              </LinkButton>
            ) : null}
          </Card>
        </Section>
      ) : r.status === "NEW" ? (
        <Notice tone="info">{tr.queued}</Notice>
      ) : null}

      {weighedStop?.weighing ? (
        <Section id="weighing" title={tr.weighingSection}>
          <Card className="space-y-3">
            <WeighingSummary weighing={weighedStop.weighing} effectiveNetGrams={weighedStop.effectiveNetGrams} />
            <ConfirmationLine confirmation={weighedStop.confirmation} />
          </Card>
          {r.canConfirm && r.stop ? (
            <Card tone="warning" className="space-y-2">
              <p className="font-semibold">{tr.isCorrect}</p>
              <ConfirmWeighing stopId={r.stop.id} netGrams={weighedStop.weighing.netGrams} />
            </Card>
          ) : null}
        </Section>
      ) : null}

      {awaitingAck.length > 0 || otherDisputes.length > 0 ? (
        <Section id="disputes" title={tr.disputeSection}>
          <ul className="space-y-3">
            {awaitingAck.map((d) => (
              <li key={d.id}>
                <DisputeAck dispute={d} context={fmt(t.c.orderNo, { n: r.number })} />
              </li>
            ))}
            {otherDisputes.map((d) => (
              <li key={d.id}>
                <DisputeSummary dispute={d} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {r.receipt ? (
        <Section id="receipt" title={tr.receiptSection}>
          <ReceiptCard receipt={r.receipt} />
        </Section>
      ) : null}

      {history.length > 0 ? (
        <Section id="history" title={tr.historySection}>
          <ol className="space-y-2">
            {history.map((s) => (
              <li key={s.id}>
                <Card className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {fmt(tr.stopLine, { trip: s.tripNumber, n: s.sequence })}
                    </span>
                    <StatusBadge kind="stop" value={s.status} />
                  </div>
                  {s.status === "SKIPPED" ? (
                    <p className="text-sm">
                      <span className="font-semibold text-amber">{L.stopStatus.SKIPPED}:</span> {s.skipReason ? uzText(s.skipReason) : tr.noReason}
                      {s.skippedAt ? <span className="text-muted"> · {formatDateTimeL(s.skippedAt, locale)}</span> : null}
                    </p>
                  ) : null}
                  {s.collectedAt ? <p className="text-sm text-muted">{fmt(tr.collectedAt, { time: formatDateTimeL(s.collectedAt, locale) })}</p> : null}
                </Card>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {r.canCancel ? (
        <Section id="cancel" title={tr.cancelSection} description={tr.cancelDesc}>
          <CancelRequest requestId={r.id} number={r.number} />
        </Section>
      ) : null}
    </div>
  );
}

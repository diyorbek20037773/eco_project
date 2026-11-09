import type { Metadata } from "next";
import type { CollectorTripDetail } from "@/server/contract";
import { getCollectorTrip } from "@/server/queries/collector";
import { uzText } from "@/domain/labels";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { SHOP_DICT } from "@/i18n/shop";
import { formatKgL, formatWindowL, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, KeyValues, PageTitle, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { IconChevronLeft, IconPhone, IconScale } from "@/components/ui/icons";
import { StopList } from "@/components/collector/StopList";
import { SettlementView, WeightsCompare } from "@/components/trips/SettlementView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.trip };
}

export default async function CollectorTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, locale]: [CollectorTripDetail, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getCollectorTrip(id), getLocale()]);
  const t = SHOP_DICT[locale];
  const tt = t.trip;

  return (
    <div className={trip.nextStopId ? "space-y-6 pb-28" : "space-y-6"}>
      <TextLink href={routes.collector.today}>
        <IconChevronLeft size={18} /> {tt.back}
      </TextLink>
      <PageTitle sub={formatWindowL(trip.windowStart, trip.windowEnd, locale)} actions={<StatusBadge kind="trip" value={trip.status} />}>
        {fmt(t.c.tripNo, { n: trip.number })}
      </PageTitle>

      <Card>
        <KeyValues
          rows={[
            { label: tt.done, value: fmt(t.today.stopsCount, { done: trip.doneCount, total: trip.totalCount }) },
            { label: tt.collected, value: formatKgL(trip.collectedGrams, locale), strong: true },
            { label: tt.buyer, value: trip.buyer.name },
            ...(trip.buyer.address ? [{ label: tt.buyerAddress, value: <span className="font-normal">{trip.buyer.address}</span> }] : []),
            ...(trip.vehicle ? [{ label: tt.vehicle, value: trip.vehicle }] : []),
            ...(trip.note ? [{ label: tt.note, value: <span className="font-normal">{uzText(trip.note)}</span> }] : []),
          ]}
        />
        {trip.buyer.phone ? (
          <LinkButton href={telHref(trip.buyer.phone)} variant="secondary" className="mt-3" icon={<IconPhone />}>
            {t.today.callBuyer}
          </LinkButton>
        ) : null}
      </Card>

      <Section id="stops" title={tt.stops}>
        <StopList stops={trip.stops} currentId={trip.nextStopId} />
      </Section>

      {trip.settlement ? (
        <Section id="settlement" title={tt.settlement} description={tt.settlementDesc}>
          <WeightsCompare deliveredGrams={trip.settlement.deliveredGrams} acceptedGrams={trip.settlement.acceptedGrams} locale={locale} />
          <SettlementView s={trip.settlement} locale={locale} />
        </Section>
      ) : trip.nextStopId === null ? (
        <Notice tone="info">{tt.awaitingSettlement}</Notice>
      ) : null}

      {trip.nextStopId ? (
        <StickyActionBar>
          <LinkButton href={routes.collector.stop(trip.nextStopId)} size="lg" block className="min-h-14" icon={<IconScale />}>
            {t.today.enterWeighing}
          </LinkButton>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

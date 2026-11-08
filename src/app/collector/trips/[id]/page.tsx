import type { Metadata } from "next";
import type { CollectorTripDetail } from "@/server/contract";
import { getCollectorTrip } from "@/server/queries/collector";
import { uzText } from "@/domain/labels";
import { formatKg, formatWindow, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, KeyValues, PageTitle, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { IconChevronLeft, IconPhone, IconScale } from "@/components/ui/icons";
import { StopList } from "@/components/collector/StopList";
import { SettlementView, WeightsCompare } from "@/components/trips/SettlementView";

export const metadata: Metadata = { title: "Reys" };

export default async function CollectorTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip: CollectorTripDetail = await getCollectorTrip(id);

  return (
    <div className={trip.nextStopId ? "space-y-6 pb-28" : "space-y-6"}>
      <TextLink href={routes.collector.today}>
        <IconChevronLeft size={18} /> Bugungi reys
      </TextLink>
      <PageTitle sub={formatWindow(trip.windowStart, trip.windowEnd)} actions={<StatusBadge kind="trip" value={trip.status} />}>
        Reys №{trip.number}
      </PageTitle>

      <Card>
        <KeyValues
          rows={[
            { label: "Bajarildi", value: `${trip.doneCount}/${trip.totalCount} nuqta` },
            { label: "Yig‘ildi (sof)", value: formatKg(trip.collectedGrams), strong: true },
            { label: "Xaridor", value: trip.buyer.name },
            ...(trip.buyer.address ? [{ label: "Xaridor manzili", value: <span className="font-normal">{trip.buyer.address}</span> }] : []),
            ...(trip.vehicle ? [{ label: "Transport", value: trip.vehicle }] : []),
            ...(trip.note ? [{ label: "Izoh", value: <span className="font-normal">{uzText(trip.note)}</span> }] : []),
          ]}
        />
        {trip.buyer.phone ? (
          <LinkButton href={telHref(trip.buyer.phone)} variant="secondary" className="mt-3" icon={<IconPhone />}>
            Xaridorga qo‘ng‘iroq
          </LinkButton>
        ) : null}
      </Card>

      <Section id="stops" title="Nuqtalar">
        <StopList stops={trip.stops} currentId={trip.nextStopId} />
      </Section>

      {trip.settlement ? (
        <Section id="settlement" title="Reys hisobi" description="Xaridor qabulidan keyingi hisoblangan qiymatlar. Pul tizimdan tashqarida o‘tkaziladi.">
          <WeightsCompare deliveredGrams={trip.settlement.deliveredGrams} acceptedGrams={trip.settlement.acceptedGrams} />
          <SettlementView s={trip.settlement} />
        </Section>
      ) : trip.nextStopId === null ? (
        <Notice tone="info">Xaridor qabulini operator kiritgach, reys hisobi shu yerda chiqadi.</Notice>
      ) : null}

      {trip.nextStopId ? (
        <StickyActionBar>
          <LinkButton href={routes.collector.stop(trip.nextStopId)} size="lg" block className="min-h-14" icon={<IconScale />}>
            Tortishni kiritish
          </LinkButton>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import type { CollectorStopDetail } from "@/server/contract";
import { getCollectorStop } from "@/server/queries/collector";
import { VOLUME_LABEL, uzText, pointTitle } from "@/domain/labels";
import { formatDateTime, formatKg, formatTime, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Thumbs } from "@/components/ui/Thumbs";
import { IconChevronLeft, IconMapPin, IconPhone } from "@/components/ui/icons";
import { StopWorkflow } from "@/components/collector/StopWorkflow";
import { ConfirmationLine, DisputeSummary, WeighingSummary } from "@/components/stops/WeighingSummary";

export const metadata: Metadata = { title: "Nuqta" };

export default async function CollectorStopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { stop, trip, canRecord }: CollectorStopDetail = await getCollectorStop(id);
  const req = stop.request;

  return (
    <div className="space-y-5">
      <TextLink href={routes.collector.trip(trip.id)}>
        <IconChevronLeft size={18} /> Reys №{trip.number}
      </TextLink>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-muted">
            {stop.sequence}-nuqta · Buyurtma №{req.number}
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
            <span className="font-semibold">Mo‘ljal:</span> {stop.point.landmark}
          </p>
        ) : null}
        <p className="tabular-nums">
          <span className="font-semibold">Tayyor:</span> {formatTime(req.readyFrom)}–{formatTime(req.readyTo)} ·{" "}
          <span className="font-semibold">Taxminan:</span>{" "}
          {req.estimatedGrams !== null ? formatKg(req.estimatedGrams) : req.volume ? VOLUME_LABEL[req.volume] : "ko‘rsatilmagan"}
        </p>
        {req.note ? (
          <p className="rounded-lg bg-kraft-soft p-2 text-sm">
            <span className="font-semibold">Izoh:</span> {uzText(req.note)}
          </p>
        ) : null}
        <Thumbs items={req.photos} label="Karton rasmlari" />
        <LinkButton href={telHref(stop.point.contactPhone)} variant="secondary" size="lg" block icon={<IconPhone />}>
          Qo‘ng‘iroq qilish · <span className="whitespace-nowrap">{stop.point.contactName ?? stop.point.contactPhone}</span>
        </LinkButton>
      </div>

      {stop.weighing ? (
        <Section id="weighing" title="Tortish natijasi">
          <Card className="space-y-3">
            <WeighingSummary weighing={stop.weighing} effectiveNetGrams={stop.effectiveNetGrams} />
            <ConfirmationLine confirmation={stop.confirmation} />
          </Card>
        </Section>
      ) : null}

      {stop.status === "SKIPPED" ? (
        <Notice tone="warning" title="Nuqta qoldirilgan">
          {uzText(stop.skipReason ?? "Sabab ko‘rsatilmagan")}
          {stop.skippedAt ? ` · ${formatDateTime(stop.skippedAt)}` : ""}
        </Notice>
      ) : null}

      {stop.disputes.length > 0 ? (
        <Section id="disputes" title="Bahs">
          <ul className="space-y-2">
            {stop.disputes.map((d) => (
              <li key={d.id}>
                <DisputeSummary dispute={d} />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Qarorga rozilik «Bugungi reys» sahifasida so‘raladi.</p>
        </Section>
      ) : null}

      {!canRecord && stop.status === "PENDING" ? (
        <Notice tone="info">Reys hali boshlanmagan yoki faol emas — tortishni hozir kiritib bo‘lmaydi.</Notice>
      ) : null}

      <StopWorkflow key={stop.id} stopId={stop.id} tripId={trip.id} canRecord={canRecord} />
    </div>
  );
}

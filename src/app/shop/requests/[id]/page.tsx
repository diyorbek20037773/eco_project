import type { Metadata } from "next";
import type { ShopRequestDetail } from "@/server/contract";
import { getShopRequest } from "@/server/queries/shop";
import { STOP_STATUS_LABEL, VOLUME_LABEL, uzText } from "@/domain/labels";
import { formatDateTime, formatKg, formatWindow, telHref } from "@/lib/format";
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

export const metadata: Metadata = { title: "Buyurtma" };

export default async function ShopRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const r: ShopRequestDetail = await getShopRequest(id);

  const weighedStop = [...r.stops].reverse().find((s) => s.weighing !== null) ?? null;
  const disputes = weighedStop?.disputes ?? [];
  const awaitingAck = disputes.filter((d) => d.status === "DECIDED" && !d.shopAckAt);
  const otherDisputes = disputes.filter((d) => !awaitingAck.includes(d));
  const history = [...r.stops].sort((a, b) => a.tripNumber - b.tripNumber || a.sequence - b.sequence);

  return (
    <div className="space-y-6">
      <TextLink href={routes.shop.home}>
        <IconChevronLeft size={18} /> Bosh sahifa
      </TextLink>

      {created ? (
        <Notice tone="success" live="polite" title={`Buyurtma №${r.number} yuborildi`}>
          Operator uni reysga qo‘shganda olib ketish vaqti shu yerda ko‘rinadi.
        </Notice>
      ) : null}

      <PageTitle sub={r.point.name} actions={<StatusBadge kind="request" value={r.status} />}>
        Buyurtma №{r.number}
      </PageTitle>

      <Card>
        <KeyValues
          rows={[
            { label: "Tayyor vaqti", value: formatWindow(r.readyFrom, r.readyTo) },
            { label: "Manzil", value: <span className="font-normal">{r.point.address}</span> },
            {
              label: "Taxminiy hajm",
              value: r.estimatedGrams !== null ? formatKg(r.estimatedGrams) : r.volume ? VOLUME_LABEL[r.volume] : "Ko‘rsatilmagan",
            },
            ...(r.note ? [{ label: "Izoh", value: <span className="font-normal">{uzText(r.note)}</span> }] : []),
            { label: "Yuborilgan", value: formatDateTime(r.createdAt) },
          ]}
        />
        {r.photos.length > 0 ? (
          <div className="mt-3">
            <Thumbs items={r.photos} label="Karton rasmlari" />
          </div>
        ) : null}
      </Card>

      {r.trip ? (
        <Section id="trip" title="Olib ketish">
          <Card tone="primary" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">Reys №{r.trip.number}</p>
              <StatusBadge kind="trip" value={r.trip.status} />
            </div>
            <p className="text-xl font-bold tabular-nums">{formatWindow(r.trip.windowStart, r.trip.windowEnd)}</p>
            <p>
              Yig‘uvchi: <span className="font-semibold">{r.trip.collectorName}</span>
            </p>
            {r.trip.collectorPhone ? (
              <LinkButton href={telHref(r.trip.collectorPhone)} variant="secondary" icon={<IconPhone />}>
                Qo‘ng‘iroq qilish · <span className="whitespace-nowrap">{r.trip.collectorPhone}</span>
              </LinkButton>
            ) : null}
          </Card>
        </Section>
      ) : r.status === "NEW" ? (
        <Notice tone="info">Buyurtma navbatda. Operator uni reysga qo‘shishi kutilmoqda.</Notice>
      ) : null}

      {weighedStop?.weighing ? (
        <Section id="weighing" title="Tortish natijasi">
          <Card className="space-y-3">
            <WeighingSummary weighing={weighedStop.weighing} effectiveNetGrams={weighedStop.effectiveNetGrams} />
            <ConfirmationLine confirmation={weighedStop.confirmation} />
          </Card>
          {r.canConfirm && r.stop ? (
            <Card tone="warning" className="space-y-2">
              <p className="font-semibold">Vazn to‘g‘rimi?</p>
              <ConfirmWeighing stopId={r.stop.id} netGrams={weighedStop.weighing.netGrams} />
            </Card>
          ) : null}
        </Section>
      ) : null}

      {awaitingAck.length > 0 || otherDisputes.length > 0 ? (
        <Section id="disputes" title="Bahs">
          <ul className="space-y-3">
            {awaitingAck.map((d) => (
              <li key={d.id}>
                <DisputeAck dispute={d} context={`Buyurtma №${r.number}`} />
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
        <Section id="receipt" title="Kvitansiya">
          <ReceiptCard receipt={r.receipt} />
        </Section>
      ) : null}

      {history.length > 0 ? (
        <Section id="history" title="Bekatlar tarixi">
          <ol className="space-y-2">
            {history.map((s) => (
              <li key={s.id}>
                <Card className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      Reys №{s.tripNumber} · {s.sequence}-nuqta
                    </span>
                    <StatusBadge kind="stop" value={s.status} />
                  </div>
                  {s.status === "SKIPPED" ? (
                    <p className="text-sm">
                      <span className="font-semibold text-amber">{STOP_STATUS_LABEL.SKIPPED}:</span> {uzText(s.skipReason ?? "sabab ko‘rsatilmagan")}
                      {s.skippedAt ? <span className="text-muted"> · {formatDateTime(s.skippedAt)}</span> : null}
                    </p>
                  ) : null}
                  {s.collectedAt ? <p className="text-sm text-muted">Olindi: {formatDateTime(s.collectedAt)}</p> : null}
                </Card>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {r.canCancel ? (
        <Section id="cancel" title="Bekor qilish" description="Karton kerak bo‘lmasa yoki boshqa yo‘l bilan topshirilgan bo‘lsa.">
          <CancelRequest requestId={r.id} number={r.number} />
        </Section>
      ) : null}
    </div>
  );
}

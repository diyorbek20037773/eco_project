"use client";

import { useRouter } from "next/navigation";
import type { TripBuilderOptions } from "@/server/contract";
import { createTrip } from "@/server/actions/operator";
import { uzText, pointTitle } from "@/domain/labels";
import { parseSom } from "@/domain/money";
import { fmt } from "@/i18n/config";
import { labelsFor } from "@/i18n/labels";
import { useLocale } from "@/i18n/LocaleProvider";
import { OPERATOR_DICT } from "@/i18n/operator";
import { formatKgL, formatSomL, formatWindowL } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { Select, SomInput, TextInput, Textarea, sanitizeSom } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { Badge, LateBadge } from "@/components/ui/StatusBadge";
import { IconArrowDown, IconArrowUp, IconTruck, IconX } from "@/components/ui/icons";

type Values = {
  order: string; // vergul bilan ajratilgan requestId’lar — to‘xtash tartibi
  collectorId: string;
  buyerId: string;
  date: string;
  fromTime: string;
  toTime: string;
  shopPrice: string;
  buyerPrice: string;
  serviceFee: string;
  vehicle: string;
  note: string;
};

export function TripBuilder({
  options,
  defaults,
}: {
  options: TripBuilderOptions;
  defaults: { date: string; fromTime: string; toTime: string; today: string };
}) {
  const router = useRouter();
  const locale = useLocale();
  const d = OPERATOR_DICT[locale];
  const t = d.builder;
  const volumeLabel = labelsFor(locale).volume;
  const formatKg = (g: number) => formatKgL(g, locale);
  const formatSom = (n: number) => formatSomL(n, locale);
  const tariff = options.currentTariff;
  const initialOrder = options.selected.map((s) => s.id).join(",");
  const form = useActionForm<Values, { tripId: string }>({
    draftKey: `trip-builder:${initialOrder}`,
    initialValues: {
      order: initialOrder,
      collectorId: options.collectors.length === 1 ? (options.collectors[0]?.id ?? "") : "",
      buyerId: options.buyers.length === 1 ? (options.buyers[0]?.id ?? "") : "",
      date: defaults.date,
      fromTime: defaults.fromTime,
      toTime: defaults.toTime,
      shopPrice: tariff ? sanitizeSom(String(tariff.shopPricePerKg)) : "",
      buyerPrice: tariff ? sanitizeSom(String(tariff.buyerPricePerKg)) : "",
      serviceFee: tariff ? sanitizeSom(String(tariff.serviceFee)) : "0",
      vehicle: "",
      note: "",
    },
    resetOnSuccess: false,
    flash: false,
    successMessage: t.success,
    onSuccess: (data) => router.push(routes.operator.trip(data.tripId)),
  });
  const v = form.values;
  const fe = form.fieldErrors;

  const byId = new Map(options.selected.map((s) => [s.id, s]));
  const order = v.order.split(",").filter((id) => byId.has(id));
  const stops = order.map((id) => byId.get(id)!);
  const knownGrams = stops.reduce((s, x) => s + (x.estimatedGrams ?? 0), 0);
  const unknown = stops.filter((x) => x.estimatedGrams === null).length;
  const buyer = options.buyers.find((b) => b.id === v.buyerId) ?? null;
  const belowMin = buyer !== null && knownGrams < buyer.minBatchGrams;

  function setOrder(next: string[]) {
    form.setValue("order", next.join(","));
  }
  function move(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const copy = [...order];
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
    setOrder(copy);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (order.length === 0) e.order = t.errOrder;
    if (!v.collectorId) e.collectorId = t.errCollector;
    if (!v.buyerId) e.buyerId = t.errBuyer;
    if (!v.date) e.date = t.errDate;
    if (!v.fromTime || !v.toTime) e.toTime = t.errTime;
    else if (v.toTime <= v.fromTime) e.toTime = t.errTimeOrder;
    if (parseSom(v.shopPrice) === null) e.shopPricePerKg = t.errShopPrice;
    if (parseSom(v.buyerPrice) === null) e.buyerPricePerKg = t.errBuyerPrice;
    if (parseSom(v.serviceFee) === null) e.serviceFee = t.errFee;
    return e;
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) {
          form.fail(t.formError, e);
          return;
        }
        void form.submit(({ clientKey, values }) =>
          createTrip({
            clientKey,
            requestIds: values.order.split(",").filter((id) => byId.has(id)),
            collectorId: values.collectorId,
            buyerId: values.buyerId,
            date: values.date,
            fromTime: values.fromTime,
            toTime: values.toTime,
            shopPricePerKg: parseSom(values.shopPrice) ?? 0,
            buyerPricePerKg: parseSom(values.buyerPrice) ?? 0,
            serviceFee: parseSom(values.serviceFee) ?? 0,
            vehicle: values.vehicle.trim() || undefined,
            note: values.note.trim() || undefined,
          }),
        );
      }}
    >
      <FormStatus form={form} only="draft" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section id="stops" title={fmt(t.stopsTitle, { n: stops.length })} description={t.stopsDesc}>
          {fe.order || fe.requestIds ? <Notice tone="danger">{fe.order ?? fe.requestIds}</Notice> : null}
          <ol className="space-y-2">
            {stops.map((s, i) => (
              <li key={s.id}>
                <Card className="flex items-start gap-3 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kraft font-bold tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <p className="font-semibold">
                      №{s.number} · {pointTitle(s.point)}
                    </p>
                    <p className="text-muted">
                      {s.point.address} · {s.point.district}
                    </p>
                    <p className="tabular-nums">
                      {formatWindowL(s.readyFrom, s.readyTo, locale)} ·{" "}
                      {s.estimatedGrams !== null ? formatKg(s.estimatedGrams) : s.volume ? volumeLabel[s.volume] : t.noVolume}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {s.status === "SKIPPED" ? (
                        <Badge tone="warning" icon="↺">
                          {t.skipped}{s.lastSkipReason ? `: ${uzText(s.lastSkipReason)}` : ""}
                        </Badge>
                      ) : null}
                      {s.isLate ? <LateBadge /> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col sm:flex-row">
                    <Button size="sm" variant="ghost" className="px-2" aria-label={fmt(d.common.moveUp, { n: s.number })} disabled={i === 0} onClick={() => move(i, -1)}>
                      <IconArrowUp size={18} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label={fmt(d.common.moveDown, { n: s.number })}
                      disabled={i === stops.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <IconArrowDown size={18} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-danger"
                      aria-label={fmt(d.common.removeFromTrip, { n: s.number })}
                      disabled={stops.length === 1}
                      onClick={() => setOrder(order.filter((id) => id !== s.id))}
                    >
                      <IconX size={18} />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
          <p className="text-sm tabular-nums">
            {t.estTotal} <span className="font-bold">{formatKg(knownGrams)}</span>
            {unknown > 0 ? <span className="text-muted">{fmt(t.unknown, { n: unknown })}</span> : null}
          </p>
          <LinkButton href={routes.operator.queue} variant="ghost">
            {t.backToQueue}
          </LinkButton>
        </Section>

        <div className="space-y-6">
          <Section id="people" title={t.peopleTitle}>
            {options.collectors.length === 0 ? (
              <Notice tone="warning" actions={<LinkButton href={routes.operator.directory} size="sm">{t.toCatalog}</LinkButton>}>
                {t.noCollectors}
              </Notice>
            ) : null}
            <Select label={t.collector} required value={v.collectorId} onChange={(e) => form.setValue("collectorId", e.target.value)} error={fe.collectorId}>
              <option value="">{t.choose}</option>
              {options.collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </Select>
            {options.buyers.length === 0 ? (
              <Notice tone="warning" actions={<LinkButton href={routes.operator.directory} size="sm">{t.toCatalog}</LinkButton>}>
                {t.noBuyers}
              </Notice>
            ) : null}
            <Select label={t.buyer} required value={v.buyerId} onChange={(e) => form.setValue("buyerId", e.target.value)} error={fe.buyerId}>
              <option value="">{t.choose}</option>
              {options.buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {buyer ? (
              <Card tone="kraft" className="space-y-1 text-sm">
                <p>
                  <span className="font-semibold">{t.qualityTerms}</span> {uzText(buyer.qualityTerms)}
                </p>
                <p className="tabular-nums">
                  <span className="font-semibold">{t.minBatch}</span> {formatKg(buyer.minBatchGrams)}
                </p>
                {buyer.contactName || buyer.phone ? (
                  <p>
                    <span className="font-semibold">{t.contact}</span> {[buyer.contactName, buyer.phone].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </Card>
            ) : null}
            {belowMin && buyer ? (
              <Notice tone="warning" title={t.belowMinTitle}>
                {fmt(t.belowMin, { kg: formatKg(knownGrams), min: formatKg(buyer.minBatchGrams) })}
              </Notice>
            ) : null}
          </Section>

          <Section id="time" title={t.timeTitle}>
            <TextInput label={t.date} type="date" required min={defaults.today} value={v.date} onChange={(e) => form.setValue("date", e.target.value)} error={fe.date} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label={t.from} type="time" required value={v.fromTime} onChange={(e) => form.setValue("fromTime", e.target.value)} error={fe.fromTime} />
              <TextInput label={t.to} type="time" required value={v.toTime} onChange={(e) => form.setValue("toTime", e.target.value)} error={fe.toTime} />
            </div>
          </Section>

          <Section
            id="prices"
            title={t.pricesTitle}
            description={tariff ? t.pricesFromTariff : t.pricesNoTariff}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <SomInput label={t.shopPrice} required value={v.shopPrice} onValueChange={(x) => form.setValue("shopPrice", x)} error={fe.shopPricePerKg} />
              <SomInput label={t.buyerPrice} required value={v.buyerPrice} onValueChange={(x) => form.setValue("buyerPrice", x)} error={fe.buyerPricePerKg} />
              <SomInput label={t.fee} required hint={t.feeHint} value={v.serviceFee} onValueChange={(x) => form.setValue("serviceFee", x)} error={fe.serviceFee} />
            </div>
            {tariff ? (
              <p className="text-sm text-muted tabular-nums">
                {fmt(t.tariffLine, { shop: formatSom(tariff.shopPricePerKg), buyer: formatSom(tariff.buyerPricePerKg), fee: formatSom(tariff.serviceFee) })}
              </p>
            ) : null}
          </Section>

          <Section id="extra" title={t.extraTitle}>
            <TextInput label={t.vehicle} optional placeholder={t.vehiclePh} value={v.vehicle} onChange={(e) => form.setValue("vehicle", e.target.value)} error={fe.vehicle} />
            <Textarea label={t.note} optional value={v.note} onChange={(e) => form.setValue("note", e.target.value)} error={fe.note} />
          </Section>
        </div>
      </div>

      <FormStatus form={form} only="result" />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" size="lg" loading={form.pending} icon={<IconTruck />} disabled={stops.length === 0}>
          {fmt(t.submit, { n: stops.length })}
        </Button>
      </div>
    </form>
  );
}

import type { Metadata } from "next";
import type { ObligationDTO, Party, StopDTO, TripDetail } from "@/server/contract";
import { getTripDetail } from "@/server/queries/operator";
import { uzText, pointTitle } from "@/domain/labels";
import { utcToTashkentParts } from "@/domain/time";
import { fmt, type Locale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { labelsFor, type EnumLabels } from "@/i18n/labels";
import { OPERATOR_DICT, type OperatorDict } from "@/i18n/operator";
import { formatDateL, formatKgL, formatSomL, formatWindowL, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, KeyValues, PageTitle, Section, StatRow } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TelegramShareButton } from "@/components/ui/TelegramShareButton";
import { Thumbs } from "@/components/ui/Thumbs";
import { IconChevronLeft, IconPhone } from "@/components/ui/icons";
import { ConfirmationLine, DisputeSummary, WeighingSummary } from "@/components/stops/WeighingSummary";
import { SettlementView, WeightsCompare } from "@/components/trips/SettlementView";
import { AuditList } from "@/components/operator/AuditList";
import { CancelTripForm, CloseTripPanel, DecideDisputeForm, StopsEditor } from "@/components/operator/TripForms";
import { AcceptanceForm, CorrectionForm, ExpenseForm, PaymentForm, type CorrectionTargets } from "@/components/operator/MoneyForms";
import { formatDateTimeL } from "@/components/operator/datetime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: OPERATOR_DICT[await getLocale()].detail.metaTitle };
}

function nowInTashkent() {
  return utcToTashkentParts(new Date());
}

function partyName(p: Party, shopName: string | null, L: EnumLabels) {
  return p === "SHOP" && shopName ? shopName : L.party[p];
}

export default async function OperatorTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale]: [TripDetail, Locale] = await Promise.all([getTripDetail(id), getLocale()]);
  const dict = OPERATOR_DICT[locale];
  const tx = dict.detail;
  const L = labelsFor(locale);
  const formatKg = (g: number) => formatKgL(g, locale);
  const formatSom = (n: number) => formatSomL(n, locale);
  const perKg = (n: number) => fmt(dict.common.perKg, { sum: formatSom(n) });
  const formatDateTime = (d: Date) => formatDateTimeL(d, locale);
  const windowText = formatWindowL(t.windowStart, t.windowEnd, locale);
  const now = nowInTashkent();
  const stops = [...t.stops].sort((a, b) => a.sequence - b.sequence);
  const activeStops = stops.filter((s) => s.status !== "REMOVED");
  const removedStops = stops.filter((s) => s.status === "REMOVED");
  const pendingStops = activeStops.filter((s) => s.status === "PENDING");
  const openDisputes = activeStops.reduce((n, s) => n + s.disputes.filter((d) => d.status !== "RESOLVED").length, 0);

  const correctionTargets: CorrectionTargets = {
    weighings: activeStops
      .filter((s): s is StopDTO & { weighing: NonNullable<StopDTO["weighing"]> } => s.weighing !== null)
      .map((s) => ({ weighingId: s.weighing.id, label: `${s.sequence}. ${s.point.shopName} (${formatKg(s.weighing.netGrams)})`, grossGrams: s.weighing.grossGrams, tareGrams: s.weighing.tareGrams })),
    acceptance: t.acceptance ? { acceptedGrams: t.acceptance.acceptedGrams } : null,
    expenses: t.expenses.map((e) => ({ expenseId: e.id, label: `${L.expenseType[e.type]} · ${formatSom(e.amount)}`, amount: e.amount })),
  };

  return (
    <div className="space-y-8">
      <div>
        <TextLink href={routes.operator.trips}>
          <IconChevronLeft size={18} /> {dict.common.trips}
        </TextLink>
        <PageTitle
          sub={<span className="tabular-nums">{windowText}</span>}
          actions={<StatusBadge kind="trip" value={t.status} className="text-base" />}
        >
          {fmt(dict.common.tripNo, { n: t.number })}
        </PageTitle>
        {t.status === "CANCELLED" && t.cancelReason ? <Notice tone="warning" title={tx.cancelledTitle}>{uzText(t.cancelReason)}</Notice> : null}
        {openDisputes > 0 ? (
          <Notice tone="danger" title={fmt(tx.disputesTitle, { n: openDisputes })}>
            {tx.disputesText}
          </Notice>
        ) : null}
      </div>

      {/* Umumiy ma’lumot va yopish */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-2 lg:col-span-2">
          <h2 className="text-lg font-bold">{tx.infoTitle}</h2>
          <KeyValues
            rows={[
              {
                label: tx.collector,
                value: (
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    {t.collector.name}
                    {t.collector.phone ? (
                      <a href={telHref(t.collector.phone)} className="inline-flex min-h-11 items-center gap-1 text-primary underline underline-offset-4">
                        <IconPhone size={16} /> {t.collector.phone}
                      </a>
                    ) : null}
                  </span>
                ),
              },
              { label: tx.buyer, value: t.buyer.name },
              { label: tx.qualityTerms, value: <span className="font-normal">{uzText(t.buyer.qualityTerms)}</span> },
              { label: tx.minBatch, value: formatKg(t.buyer.minBatchGrams) },
              { label: tx.responsible, value: L.party[t.responsibleParty] },
              { label: tx.vehicle, value: t.vehicle ?? "—" },
              { label: tx.priceShop, value: perKg(t.prices.shopPricePerKg) },
              { label: tx.priceBuyer, value: perKg(t.prices.buyerPricePerKg) },
              { label: tx.serviceFee, value: formatSom(t.prices.serviceFee) },
              ...(t.note ? [{ label: tx.note, value: <span className="font-normal">{uzText(t.note)}</span> }] : []),
              ...(t.closedAt ? [{ label: tx.closedAt, value: formatDateTime(t.closedAt) }] : []),
            ]}
          />
          {t.status !== "CANCELLED" ? (
            <div className="pt-2">
              <TelegramShareButton url={t.shareUrl} text={fmt(tx.share, { n: t.number, window: windowText })} />
            </div>
          ) : null}
        </Card>
        {t.status !== "CANCELLED" ? (
          <Card className="space-y-2" tone={t.status === "AWAITING_PAYMENT" ? "warning" : "surface"}>
            <h2 className="text-lg font-bold">{tx.closeTitle}</h2>
            <CloseTripPanel tripId={t.id} checks={t.closeChecks} canClose={t.allowed.close} />
          </Card>
        ) : null}
      </div>

      {/* Bekatlar */}
      <Section id="stops" title={fmt(tx.stopsTitle, { n: activeStops.length })}>
        {activeStops.length === 0 && removedStops.length === 0 ? <p className="text-muted">{tx.noStops}</p> : null}
        <ol className="grid gap-3 xl:grid-cols-2">
          {activeStops.map((s) => (
            <li key={s.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {s.sequence}. {pointTitle(s.point)}
                    </p>
                    <p className="text-sm text-muted">
                      №{s.request.number} · {s.point.address} · {s.point.district}
                    </p>
                    <p className="text-sm">
                      <a href={telHref(s.point.contactPhone)} className="inline-flex min-h-11 items-center gap-1 text-primary underline underline-offset-4">
                        <IconPhone size={16} /> {s.point.contactName ?? tx.contact} · {s.point.contactPhone}
                      </a>
                    </p>
                  </div>
                  <StatusBadge kind="stop" value={s.status} />
                </div>
                {s.status === "SKIPPED" ? (
                  <Notice tone="warning" title={tx.skippedTitle}>
                    {s.skipReason ? uzText(s.skipReason) : tx.noReason}
                    {s.skippedAt ? ` · ${formatDateTime(s.skippedAt)}` : ""}
                    {tx.skippedTail}
                  </Notice>
                ) : null}
                {s.weighing ? (
                  <>
                    <WeighingSummary weighing={s.weighing} effectiveNetGrams={s.effectiveNetGrams} />
                    <ConfirmationLine confirmation={s.confirmation} />
                  </>
                ) : null}
                {s.disputes.map((d) =>
                  d.status === "OPEN" ? (
                    <div key={d.id} className="space-y-2">
                      <DisputeSummary dispute={d} />
                      <Disclosure summary={tx.decideSummary} defaultOpen>
                        <DecideDisputeForm disputeId={d.id} suggestedGrams={d.claimedNetGrams ?? s.weighing?.netGrams ?? null} />
                      </Disclosure>
                    </div>
                  ) : (
                    <DisputeSummary key={d.id} dispute={d} />
                  ),
                )}
              </Card>
            </li>
          ))}
        </ol>
        {removedStops.length > 0 ? (
          <p className="text-sm text-muted">
            {t.status === "CANCELLED" ? tx.removedCancelled : tx.removed}
            {removedStops.map((s) => `№${s.request.number} ${s.point.shopName}`).join(", ")}
          </p>
        ) : null}
        {t.allowed.reorder && pendingStops.length > 0 ? (
          <Disclosure summary={tx.reorderSummary}>
            <StopsEditor tripId={t.id} stops={pendingStops} />
          </Disclosure>
        ) : null}
        {t.allowed.cancel ? (
          <div>
            <CancelTripForm tripId={t.id} />
          </div>
        ) : null}
      </Section>

      {/* Vaznlar */}
      <Section id="weights" title={tx.weightsTitle} description={tx.weightsDesc}>
        <WeightsCompare deliveredGrams={t.deliveredGrams} acceptedGrams={t.acceptance?.acceptedGrams ?? null} locale={locale} />
        {activeStops.some((s) => s.weighing) ? (
          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{tx.weightsCaption}</caption>
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">{tx.colStop}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">{tx.colGross}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">{tx.colTare}</th>
                  <th scope="col" className="px-3 py-2 text-right">{tx.colNet}</th>
                  <th scope="col" className="px-3 py-2 text-right">{tx.colCounted}</th>
                </tr>
              </thead>
              <tbody>
                {activeStops.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      {s.sequence}. {s.point.shopName}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.weighing ? formatKg(s.weighing.grossGrams) : "—"}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.weighing ? formatKg(s.weighing.tareGrams) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.weighing ? formatKg(s.weighing.netGrams) : "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{s.effectiveNetGrams !== null ? formatKg(s.effectiveNetGrams) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line-strong font-bold">
                  <td className="px-3 py-2">{tx.totalDelivered}</td>
                  <td className="hidden sm:table-cell" colSpan={2} />
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{formatKg(t.deliveredGrams)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : null}

        {t.acceptance ? (
          <Card tone="kraft" className="space-y-2">
            <h3 className="font-bold">{tx.acceptanceTitle}</h3>
            <KeyValues
              className="divide-kraft-line/50"
              rows={[
                { label: tx.accepted, value: formatKg(t.acceptance.acceptedGrams), strong: true },
                { label: tx.delivered, value: formatKg(t.acceptance.deliveredGrams) },
                { label: tx.discrepancy, value: formatKg(t.acceptance.discrepancyGrams) },
                { label: tx.quality, value: L.quality[t.acceptance.quality] },
                ...(t.acceptance.qualityNote ? [{ label: tx.qualityNote, value: <span className="font-normal">{uzText(t.acceptance.qualityNote)}</span> }] : []),
                ...(t.acceptance.discrepancyReason ? [{ label: tx.discrepancyReason, value: <span className="font-normal">{uzText(t.acceptance.discrepancyReason)}</span> }] : []),
                ...(t.acceptance.decision ? [{ label: tx.decision, value: L.discrepancyDecision[t.acceptance.decision] }] : []),
                ...(t.acceptance.decisionNote ? [{ label: tx.decisionNote, value: <span className="font-normal">{uzText(t.acceptance.decisionNote)}</span> }] : []),
                { label: tx.buyerPrice, value: perKg(t.acceptance.buyerPricePerKg) },
                { label: tx.buyerRef, value: t.acceptance.buyerReference },
                { label: tx.acceptedAt, value: formatDateTime(t.acceptance.acceptedAt) },
                { label: tx.recordedBy, value: t.acceptance.recordedByName },
              ]}
            />
            <Thumbs items={t.acceptance.documents} label={tx.docs} />
            <p className="text-sm text-ink/80">{tx.notProcessed}</p>
          </Card>
        ) : t.allowed.recordAcceptance ? (
          <Card className="space-y-3">
            <h3 className="text-lg font-bold">{tx.recordAcceptance}</h3>
            <AcceptanceForm tripId={t.id} deliveredGrams={t.deliveredGrams} buyerPricePerKg={t.prices.buyerPricePerKg} today={now.date} nowTime={now.time} />
          </Card>
        ) : t.status === "PLANNED" || t.status === "IN_PROGRESS" ? (
          <p className="text-muted">{tx.acceptanceLater}</p>
        ) : null}
      </Section>

      {/* Pul */}
      <Section id="money" title={tx.moneyTitle} description={tx.moneyDesc}>
        {t.settlement ? <SettlementView s={t.settlement} locale={locale} /> : <Notice tone="info">{tx.settlementLater}</Notice>}

        <Card className="space-y-3">
          <h3 className="text-lg font-bold">{tx.expensesTitle}</h3>
          {t.expenses.length === 0 ? (
            <p className="text-muted">{tx.noExpenses}</p>
          ) : (
            <ul className="divide-y divide-line">
              {t.expenses.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{L.expenseType[e.type]}</span>
                    <span className="block text-sm text-muted">
                      {fmt(tx.payer, { p: L.party[e.payer] })}
                      {e.recipient ? fmt(tx.recipient, { r: e.recipient }) : ""}
                      {e.note ? ` · ${uzText(e.note)}` : ""} · {e.createdByName}, {formatDateTime(e.createdAt)}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">{formatSom(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {t.allowed.addExpense ? (
            <Disclosure summary={tx.addExpense}>
              <ExpenseForm tripId={t.id} />
            </Disclosure>
          ) : null}
        </Card>

        <div className="space-y-3">
          <h3 className="text-lg font-bold">{tx.obligationsTitle}</h3>
          {t.obligations.length === 0 ? (
            <p className="text-muted">{tx.noObligations}</p>
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {t.obligations.map((o) => (
                <li key={o.id}>
                  <ObligationCard o={o} canPay={t.allowed.recordPayment} today={now.date} locale={locale} tx={tx} L={L} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {t.allowed.correct ? (
        <Section id="correct" title={tx.correctTitle} description={tx.correctDesc}>
          <Card>
            <CorrectionForm tripId={t.id} targets={correctionTargets} />
          </Card>
        </Section>
      ) : null}

      <Section id="audit" title={tx.auditTitle}>
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary underline-offset-4 hover:underline">
            {fmt(tx.auditShow, { n: t.audit.length })}
          </summary>
          <div className="mt-2">
            <AuditList items={t.audit} locale={locale} />
          </div>
        </details>
      </Section>
    </div>
  );
}

function ObligationCard({
  o,
  canPay,
  today,
  locale,
  tx,
  L,
}: {
  o: ObligationDTO;
  canPay: boolean;
  today: string;
  locale: Locale;
  tx: OperatorDict["detail"];
  L: EnumLabels;
}) {
  const formatSom = (n: number) => formatSomL(n, locale);
  const from = partyName(o.payer, o.payer === "SHOP" ? o.shopName : null, L);
  const to = partyName(o.payee, o.payee === "SHOP" ? o.shopName : null, L);
  return (
    <Card className="space-y-2" tone={o.state === "OVERPAID" ? "danger" : "surface"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{L.obligationType[o.type]}</p>
          <p className="text-sm text-muted">
            {from} → {to}
          </p>
        </div>
        <StatusBadge kind="pay" value={o.state} />
      </div>
      <StatRow
        items={[
          { label: tx.oblAccrued, value: formatSom(o.amount) },
          { label: tx.oblPaid, value: formatSom(o.paid) },
          { label: o.remaining < 0 ? tx.oblOver : tx.oblRemaining, value: formatSom(Math.abs(o.remaining)) },
        ]}
      />
      {o.payments.length > 0 ? (
        <ul className="space-y-1 text-sm" aria-label={tx.payHistory}>
          {o.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-1">
              <span className="min-w-0">
                {L.paymentKind[p.kind]} · {formatDateL(p.paidAt, locale)}
                {p.method ? ` · ${p.method}` : ""}
                {p.reference ? ` · ${p.reference}` : ""}
                <span className="text-muted"> · {p.recordedByName}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {p.kind === "REFUND" ? "−" : ""}
                {formatSom(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{tx.noPayments}</p>
      )}
      {canPay && o.remaining !== 0 ? (
        <Disclosure summary={o.remaining < 0 ? tx.recordRefund : tx.recordPayment}>
          <PaymentForm obligation={o} today={today} />
        </Disclosure>
      ) : null}
    </Card>
  );
}


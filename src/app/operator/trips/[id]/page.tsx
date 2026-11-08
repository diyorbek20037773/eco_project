import type { Metadata } from "next";
import type { ObligationDTO, Party, StopDTO, TripDetail } from "@/server/contract";
import { getTripDetail } from "@/server/queries/operator";
import { DISCREPANCY_DECISION_LABEL, EXPENSE_TYPE_LABEL, OBLIGATION_TYPE_LABEL, PARTY_LABEL, PAYMENT_KIND_LABEL, QUALITY_LABEL, uzText, pointTitle } from "@/domain/labels";
import { utcToTashkentParts } from "@/domain/time";
import { formatDate, formatDateTime, formatKg, formatSom, formatWindow, telHref } from "@/lib/format";
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

export const metadata: Metadata = { title: "Reys" };

function nowInTashkent() {
  return utcToTashkentParts(new Date());
}

function partyName(p: Party, shopName: string | null) {
  return p === "SHOP" && shopName ? shopName : PARTY_LABEL[p];
}

export default async function OperatorTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t: TripDetail = await getTripDetail(id);
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
    expenses: t.expenses.map((e) => ({ expenseId: e.id, label: `${EXPENSE_TYPE_LABEL[e.type]} · ${formatSom(e.amount)}`, amount: e.amount })),
  };

  return (
    <div className="space-y-8">
      <div>
        <TextLink href={routes.operator.trips}>
          <IconChevronLeft size={18} /> Reyslar
        </TextLink>
        <PageTitle
          sub={<span className="tabular-nums">{formatWindow(t.windowStart, t.windowEnd)}</span>}
          actions={<StatusBadge kind="trip" value={t.status} className="text-base" />}
        >
          Reys №{t.number}
        </PageTitle>
        {t.status === "CANCELLED" && t.cancelReason ? <Notice tone="warning" title="Reys bekor qilingan">{uzText(t.cancelReason)}</Notice> : null}
        {openDisputes > 0 ? (
          <Notice tone="danger" title={`Bahs: ${openDisputes} ta hal qilinmagan`}>
            Bekatlar bo‘limida qaror chiqaring. Bahs hal bo‘lmaguncha reys yopilmaydi.
          </Notice>
        ) : null}
      </div>

      {/* Umumiy ma’lumot va yopish */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-2 lg:col-span-2">
          <h2 className="text-lg font-bold">Reys ma’lumoti</h2>
          <KeyValues
            rows={[
              {
                label: "Yig‘uvchi",
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
              { label: "Xaridor", value: t.buyer.name },
              { label: "Sifat sharti", value: <span className="font-normal">{uzText(t.buyer.qualityTerms)}</span> },
              { label: "Minimal partiya", value: formatKg(t.buyer.minBatchGrams) },
              { label: "Mas’ul tomon", value: PARTY_LABEL[t.responsibleParty] },
              { label: "Transport", value: t.vehicle ?? "—" },
              { label: "Narx nusxasi: do‘konga", value: `${formatSom(t.prices.shopPricePerKg)}/kg` },
              { label: "Narx nusxasi: xaridor", value: `${formatSom(t.prices.buyerPricePerKg)}/kg` },
              { label: "Eco Point xizmat haqi", value: formatSom(t.prices.serviceFee) },
              ...(t.note ? [{ label: "Izoh", value: <span className="font-normal">{uzText(t.note)}</span> }] : []),
              ...(t.closedAt ? [{ label: "Yopilgan", value: formatDateTime(t.closedAt) }] : []),
            ]}
          />
          <div className="pt-2">
            <TelegramShareButton url={t.shareUrl} text={`Eco Point · Reys №${t.number} (${formatWindow(t.windowStart, t.windowEnd)})`} />
          </div>
        </Card>
        <Card className="space-y-2" tone={t.status === "AWAITING_PAYMENT" ? "warning" : "surface"}>
          <h2 className="text-lg font-bold">Yopish shartlari</h2>
          <CloseTripPanel tripId={t.id} checks={t.closeChecks} canClose={t.allowed.close} />
        </Card>
      </div>

      {/* Bekatlar */}
      <Section id="stops" title={`Bekatlar (${activeStops.length})`}>
        {activeStops.length === 0 ? <p className="text-muted">Bekat yo‘q.</p> : null}
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
                        <IconPhone size={16} /> {s.point.contactName ?? "Kontakt"} · {s.point.contactPhone}
                      </a>
                    </p>
                  </div>
                  <StatusBadge kind="stop" value={s.status} />
                </div>
                {s.status === "SKIPPED" ? (
                  <Notice tone="warning" title="Qoldirildi">
                    {uzText(s.skipReason ?? "Sabab ko‘rsatilmagan")}
                    {s.skippedAt ? ` · ${formatDateTime(s.skippedAt)}` : ""}. Buyurtma navbatga qaytgan — boshqa reysga rejalashtiring.
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
                      <Disclosure summary="⚠ Bahs bo‘yicha qaror chiqarish" defaultOpen>
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
          <p className="text-sm text-muted">Reysdan olib tashlangan: {removedStops.map((s) => `№${s.request.number} ${s.point.shopName}`).join(", ")}</p>
        ) : null}
        {t.allowed.reorder && pendingStops.length > 0 ? (
          <Disclosure summary="Bekatlar tartibini o‘zgartirish yoki olib tashlash">
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
      <Section id="weights" title="Vaznlar" description="Topshirishlar (bekatlardagi sof vazn) va xaridor qabuli alohida saqlanadi.">
        <WeightsCompare deliveredGrams={t.deliveredGrams} acceptedGrams={t.acceptance?.acceptedGrams ?? null} />
        {activeStops.some((s) => s.weighing) ? (
          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Bekatlar bo‘yicha vaznlar</caption>
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Bekat</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Brutto</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Tara</th>
                  <th scope="col" className="px-3 py-2 text-right">Sof</th>
                  <th scope="col" className="px-3 py-2 text-right">Hisobda</th>
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
                  <td className="px-3 py-2">Jami topshirildi</td>
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
            <h3 className="font-bold">Xaridor qabuli</h3>
            <KeyValues
              className="divide-kraft-line/50"
              rows={[
                { label: "Qabul vazni", value: formatKg(t.acceptance.acceptedGrams), strong: true },
                { label: "Topshirilgan", value: formatKg(t.acceptance.deliveredGrams) },
                { label: "Tafovut", value: formatKg(t.acceptance.discrepancyGrams) },
                { label: "Sifat", value: QUALITY_LABEL[t.acceptance.quality] },
                ...(t.acceptance.qualityNote ? [{ label: "Sifat izohi", value: <span className="font-normal">{uzText(t.acceptance.qualityNote)}</span> }] : []),
                ...(t.acceptance.discrepancyReason ? [{ label: "Tafovut sababi", value: <span className="font-normal">{uzText(t.acceptance.discrepancyReason)}</span> }] : []),
                ...(t.acceptance.decision ? [{ label: "Operator qarori", value: DISCREPANCY_DECISION_LABEL[t.acceptance.decision] }] : []),
                ...(t.acceptance.decisionNote ? [{ label: "Qaror izohi", value: <span className="font-normal">{uzText(t.acceptance.decisionNote)}</span> }] : []),
                { label: "Xaridor narxi", value: `${formatSom(t.acceptance.buyerPricePerKg)}/kg` },
                { label: "Xaridor tasdig‘i", value: t.acceptance.buyerReference },
                { label: "Qabul vaqti", value: formatDateTime(t.acceptance.acceptedAt) },
                { label: "Kiritdi", value: t.acceptance.recordedByName },
              ]}
            />
            <Thumbs items={t.acceptance.documents} label="Qabul hujjatlari" />
            <p className="text-sm text-ink/80">Bu xaridor qabul qilgan vazn; «qayta ishlandi» degan tasdiq emas.</p>
          </Card>
        ) : t.allowed.recordAcceptance ? (
          <Card className="space-y-3">
            <h3 className="text-lg font-bold">Xaridor qabulini kiritish</h3>
            <AcceptanceForm tripId={t.id} deliveredGrams={t.deliveredGrams} buyerPricePerKg={t.prices.buyerPricePerKg} today={now.date} nowTime={now.time} />
          </Card>
        ) : t.status === "PLANNED" || t.status === "IN_PROGRESS" ? (
          <p className="text-muted">Xaridor qabuli barcha bekatlar bajarilgach kiritiladi.</p>
        ) : null}
      </Section>

      {/* Pul */}
      <Section id="money" title="Pul" description="Hisoblangan summa va haqiqatda qayd etilgan to‘lovlar alohida. Pul tizimdan tashqarida o‘tkaziladi.">
        {t.settlement ? <SettlementView s={t.settlement} /> : <Notice tone="info">Reys iqtisodi xaridor qabulidan keyin hisoblanadi.</Notice>}

        <Card className="space-y-3">
          <h3 className="text-lg font-bold">Xarajatlar</h3>
          {t.expenses.length === 0 ? (
            <p className="text-muted">Xarajat qayd etilmagan.</p>
          ) : (
            <ul className="divide-y divide-line">
              {t.expenses.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{EXPENSE_TYPE_LABEL[e.type]}</span>
                    <span className="block text-sm text-muted">
                      To‘lovchi: {PARTY_LABEL[e.payer]}
                      {e.recipient ? ` · oluvchi: ${e.recipient}` : ""}
                      {e.note ? ` · ${uzText(e.note)}` : ""} · {e.createdByName}, {formatDateTime(e.createdAt)}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">{formatSom(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {t.allowed.addExpense ? (
            <Disclosure summary="Xarajat qo‘shish">
              <ExpenseForm tripId={t.id} />
            </Disclosure>
          ) : null}
        </Card>

        <div className="space-y-3">
          <h3 className="text-lg font-bold">Majburiyatlar va to‘lovlar</h3>
          {t.obligations.length === 0 ? (
            <p className="text-muted">Majburiyatlar xaridor qabulidan keyin yaratiladi.</p>
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {t.obligations.map((o) => (
                <li key={o.id}>
                  <ObligationCard o={o} canPay={t.allowed.recordPayment} today={now.date} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {t.allowed.correct ? (
        <Section id="correct" title="Tuzatish" description="Avvalgi qiymat, yangi qiymat, sabab, muallif va vaqt auditda saqlanadi; balans qayta hisoblanadi.">
          <Card>
            <CorrectionForm tripId={t.id} targets={correctionTargets} />
          </Card>
        </Section>
      ) : null}

      <Section id="audit" title="Audit tarixi">
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary underline-offset-4 hover:underline">
            Audit yozuvlarini ko‘rsatish ({t.audit.length})
          </summary>
          <div className="mt-2">
            <AuditList items={t.audit} />
          </div>
        </details>
      </Section>
    </div>
  );
}

function ObligationCard({ o, canPay, today }: { o: ObligationDTO; canPay: boolean; today: string }) {
  const from = partyName(o.payer, o.payer === "SHOP" ? o.shopName : null);
  const to = partyName(o.payee, o.payee === "SHOP" ? o.shopName : null);
  return (
    <Card className="space-y-2" tone={o.state === "OVERPAID" ? "danger" : "surface"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{OBLIGATION_TYPE_LABEL[o.type]}</p>
          <p className="text-sm text-muted">
            {from} → {to}
          </p>
        </div>
        <StatusBadge kind="pay" value={o.state} />
      </div>
      <StatRow
        items={[
          { label: "Hisoblangan", value: formatSom(o.amount) },
          { label: "To‘langan", value: formatSom(o.paid) },
          { label: o.remaining < 0 ? "Ortiqcha" : "Qoldiq", value: formatSom(Math.abs(o.remaining)) },
        ]}
      />
      {o.payments.length > 0 ? (
        <ul className="space-y-1 text-sm" aria-label="To‘lovlar tarixi">
          {o.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-1">
              <span className="min-w-0">
                {PAYMENT_KIND_LABEL[p.kind]} · {formatDate(p.paidAt)}
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
        <p className="text-sm text-muted">Hali to‘lov qayd etilmagan.</p>
      )}
      {canPay && o.remaining !== 0 ? (
        <Disclosure summary={o.remaining < 0 ? "Qaytarishni qayd etish" : "To‘lovni qayd etish"}>
          <PaymentForm obligation={o} today={today} />
        </Disclosure>
      ) : null}
    </Card>
  );
}


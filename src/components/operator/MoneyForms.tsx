"use client";

import { useState } from "react";
import type { DiscrepancyDecision, ExpenseType, ObligationDTO, Party, Quality } from "@/server/contract";
import { addExpense, correctRecord, recordAcceptance, recordPayment } from "@/server/actions/operator";
import { EXPENSE_OPTIONS, PARTY_OPTIONS, QUALITY_OPTIONS } from "@/domain/labels";
import { parseSom } from "@/domain/money";
import { parseKgToGrams } from "@/domain/weight";
import { fmt } from "@/i18n/config";
import { labelsFor } from "@/i18n/labels";
import { useLocale } from "@/i18n/LocaleProvider";
import { OPERATOR_DICT } from "@/i18n/operator";
import { formatKgL, formatSomL, gramsToKgInput } from "@/lib/format";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, KgInput, Select, SomInput, TextInput, Textarea, sanitizeSom } from "@/components/ui/Field";
import { PhotoInput } from "@/components/ui/PhotoInput";
import { Notice } from "@/components/ui/States";

// ---------------------------------------------------------------------------
// Xaridor qabuli
// ---------------------------------------------------------------------------
type AcceptanceValues = {
  acceptedKg: string;
  quality: string;
  qualityNote: string;
  discrepancyReason: string;
  decision: string;
  decisionNote: string;
  buyerPrice: string;
  buyerReference: string;
  acceptedDate: string;
  acceptedTime: string;
  docId: string;
};

export function AcceptanceForm({
  tripId,
  deliveredGrams,
  buyerPricePerKg,
  today,
  nowTime,
}: {
  tripId: string;
  deliveredGrams: number;
  buyerPricePerKg: number;
  today: string;
  nowTime: string;
}) {
  const locale = useLocale();
  const t = OPERATOR_DICT[locale].acceptance;
  const L = labelsFor(locale);
  const formatKg = (g: number) => formatKgL(g, locale);
  const [uploading, setUploading] = useState(false);
  const form = useActionForm<AcceptanceValues, { discrepancyGrams: number }>({
    draftKey: `acceptance:${tripId}`,
    initialValues: {
      acceptedKg: "",
      quality: "GOOD",
      qualityNote: "",
      discrepancyReason: "",
      decision: "",
      decisionNote: "",
      buyerPrice: sanitizeSom(String(buyerPricePerKg)),
      buyerReference: "",
      acceptedDate: today,
      acceptedTime: nowTime,
      docId: "",
    },
    resetOnSuccess: false,
    successMessage: (d) => (d.discrepancyGrams === 0 ? t.successNoDiff : fmt(t.successDiff, { kg: formatKg(d.discrepancyGrams) })),
  });
  const v = form.values;
  const fe = form.fieldErrors;
  const acceptedG = v.acceptedKg.trim() ? parseKgToGrams(v.acceptedKg) : null;
  const diff = acceptedG === null ? null : acceptedG - deliveredGrams;
  const hasDiff = diff !== null && diff !== 0;

  function validate() {
    const e: Record<string, string> = {};
    if (acceptedG === null || acceptedG <= 0) e.acceptedKg = t.errAccepted;
    if (hasDiff) {
      if (v.discrepancyReason.trim().length < 3) e.discrepancyReason = t.errReason;
      if (!v.decision) e.decision = t.errDecision;
      if (v.decision === "OTHER" && v.decisionNote.trim().length < 3) e.decisionNote = t.errDecisionNote;
    }
    if (parseSom(v.buyerPrice) === null) e.buyerPricePerKg = t.errPrice;
    if (v.buyerReference.trim().length < 2) e.buyerReference = t.errRef;
    if (!v.acceptedDate) e.acceptedDate = t.errDate;
    if (!/^\d{2}:\d{2}$/.test(v.acceptedTime)) e.acceptedTime = t.errTime;
    return e;
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) {
          form.fail(t.formError, e);
          return;
        }
        void form.submit(({ clientKey, values }) =>
          recordAcceptance({
            tripId,
            clientKey,
            acceptedKg: values.acceptedKg,
            quality: values.quality as Quality,
            qualityNote: values.qualityNote.trim() || undefined,
            discrepancyReason: hasDiff ? values.discrepancyReason.trim() : undefined,
            decision: hasDiff ? (values.decision as DiscrepancyDecision) : undefined,
            decisionNote: hasDiff && values.decisionNote.trim() ? values.decisionNote.trim() : undefined,
            buyerPricePerKg: parseSom(values.buyerPrice) ?? 0,
            buyerReference: values.buyerReference.trim(),
            acceptedDate: values.acceptedDate,
            acceptedTime: values.acceptedTime,
            documentAttachmentIds: values.docId ? [values.docId] : undefined,
          }),
        );
      }}
    >
      <FormStatus form={form} only="draft" />
      <Notice tone="info">{t.intro}</Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <KgInput
          label={t.accepted}
          required
          hint={fmt(t.deliveredHint, { kg: formatKg(deliveredGrams) })}
          value={v.acceptedKg}
          onValueChange={(x) => form.setValue("acceptedKg", x)}
          error={fe.acceptedKg}
        />
        <SomInput label={t.buyerPrice} required value={v.buyerPrice} onValueChange={(x) => form.setValue("buyerPrice", x)} error={fe.buyerPricePerKg} />
      </div>

      <div aria-live="polite">
        {diff !== null ? (
          hasDiff ? (
            <Notice tone="warning" title={fmt(t.diffTitle, { kg: `${diff > 0 ? "+" : ""}${formatKg(diff)}` })}>
              {t.diffText}
            </Notice>
          ) : (
            <Notice tone="success" title={t.noDiffTitle}>
              {t.noDiffText}
            </Notice>
          )
        ) : null}
      </div>

      {hasDiff ? (
        <div className="space-y-3 rounded-xl border border-amber/40 bg-amber-soft/50 p-3">
          <Textarea
            label={t.reason}
            required
            placeholder={t.reasonPh}
            value={v.discrepancyReason}
            onChange={(e) => form.setValue("discrepancyReason", e.target.value)}
            error={fe.discrepancyReason}
          />
          <ChoiceGroup
            legend={t.decision}
            name="decision"
            required
            value={v.decision}
            onChange={(x) => form.setValue("decision", x)}
            error={fe.decision}
            options={(["TRIP_ABSORBS", "OTHER"] as DiscrepancyDecision[]).map((d) => ({ value: d, label: L.discrepancyDecision[d] }))}
          />
          {v.decision === "OTHER" ? (
            <Textarea label={t.decisionNote} required value={v.decisionNote} onChange={(e) => form.setValue("decisionNote", e.target.value)} error={fe.decisionNote} />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t.quality} required value={v.quality} onChange={(e) => form.setValue("quality", e.target.value)} error={fe.quality}>
          {QUALITY_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {L.quality[q]}
            </option>
          ))}
        </Select>
        <TextInput label={t.qualityNote} optional value={v.qualityNote} onChange={(e) => form.setValue("qualityNote", e.target.value)} error={fe.qualityNote} />
      </div>

      <TextInput
        label={t.buyerRef}
        required
        hint={t.buyerRefHint}
        value={v.buyerReference}
        onChange={(e) => form.setValue("buyerReference", e.target.value)}
        error={fe.buyerReference}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t.date} type="date" required value={v.acceptedDate} onChange={(e) => form.setValue("acceptedDate", e.target.value)} error={fe.acceptedDate} />
        <TextInput label={t.time} type="time" required value={v.acceptedTime} onChange={(e) => form.setValue("acceptedTime", e.target.value)} error={fe.acceptedTime} />
      </div>
      <PhotoInput
        kind="ACCEPTANCE_DOC"
        label={t.doc}
        value={v.docId || null}
        onChange={(id) => form.setValue("docId", id ?? "")}
        onUploadingChange={setUploading}
      />
      <FormStatus form={form} only="result" />
      <Button type="submit" size="lg" loading={form.pending} disabled={uploading}>
        {t.submit}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Xarajat
// ---------------------------------------------------------------------------
export function ExpenseForm({ tripId }: { tripId: string }) {
  const locale = useLocale();
  const t = OPERATOR_DICT[locale].expense;
  const L = labelsFor(locale);
  const form = useActionForm<{ type: string; amount: string; payer: string; recipient: string; note: string }, { expenseId: string }>({
    draftKey: `expense:${tripId}`,
    initialValues: { type: "TRANSPORT", amount: "", payer: "COLLECTOR", recipient: "", note: "" },
    successMessage: t.success,
  });
  const v = form.values;
  const fe = form.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const amount = parseSom(v.amount);
        if (amount === null || amount <= 0) {
          form.fail(t.errAmount, { amount: t.errAmountField });
          return;
        }
        void form.submit(({ clientKey, values }) =>
          addExpense({
            tripId,
            clientKey,
            type: values.type as ExpenseType,
            amount,
            payer: values.payer as Party,
            recipient: values.recipient.trim() || undefined,
            note: values.note.trim() || undefined,
          }),
        );
      }}
    >
      <FormStatus form={form} only="draft" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t.type} required value={v.type} onChange={(e) => form.setValue("type", e.target.value)} error={fe.type}>
          {EXPENSE_OPTIONS.map((x) => (
            <option key={x} value={x}>
              {L.expenseType[x]}
            </option>
          ))}
        </Select>
        <SomInput label={t.amount} required value={v.amount} onValueChange={(x) => form.setValue("amount", x)} error={fe.amount} />
        <Select label={t.payer} required value={v.payer} onChange={(e) => form.setValue("payer", e.target.value)} error={fe.payer}>
          {PARTY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {L.party[p]}
            </option>
          ))}
        </Select>
        <TextInput label={t.recipient} optional placeholder={t.recipientPh} value={v.recipient} onChange={(e) => form.setValue("recipient", e.target.value)} error={fe.recipient} />
      </div>
      <TextInput label={t.note} optional value={v.note} onChange={(e) => form.setValue("note", e.target.value)} error={fe.note} />
      <FormStatus form={form} only="result" />
      <Button type="submit" loading={form.pending}>
        {t.submit}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// To‘lov (qisman ham)
// ---------------------------------------------------------------------------
export function PaymentForm({ obligation, today }: { obligation: ObligationDTO; today: string }) {
  const locale = useLocale();
  const t = OPERATOR_DICT[locale].payment;
  const formatSom = (n: number) => formatSomL(n, locale);
  const refund = obligation.remaining < 0;
  const max = Math.abs(obligation.remaining);
  const form = useActionForm<{ amount: string; paidDate: string; method: string; reference: string }, { paymentId: string; remaining: number }>({
    draftKey: `payment:${obligation.id}`,
    initialValues: { amount: sanitizeSom(String(max)), paidDate: today, method: t.methods[0] ?? "", reference: "" },
    successMessage: (d) => (d.remaining === 0 ? t.successZero : fmt(t.success, { sum: formatSom(d.remaining) })),
  });
  const v = form.values;
  const fe = form.fieldErrors;
  const amount = parseSom(v.amount);
  const tooMuch = amount !== null && amount > max;
  const maxText = formatSom(max);
  // Saqlangan qoralama boshqa tildagi usulni saqlagan bo‘lishi mumkin — u ham ro‘yxatda ko‘rinsin.
  const methods = v.method && !t.methods.includes(v.method) ? [v.method, ...t.methods] : t.methods;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (amount === null || amount <= 0) {
          form.fail(t.errAmount, { amount: t.errAmountField });
          return;
        }
        if (tooMuch) {
          form.fail(fmt(t.tooMuch, { max: maxText }), { amount: fmt(t.atMost, { max: maxText }) });
          return;
        }
        void form.submit(({ clientKey, values }) =>
          recordPayment({
            obligationId: obligation.id,
            clientKey,
            kind: refund ? "REFUND" : "PAYMENT",
            amount,
            paidDate: values.paidDate,
            method: values.method || undefined,
            reference: values.reference.trim() || undefined,
          }),
        );
      }}
    >
      {refund ? <Notice tone="warning">{fmt(t.overpaid, { max: maxText })}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <SomInput
          label={refund ? t.refundAmount : t.paidAmount}
          required
          hint={fmt(t.remainingHint, { max: maxText })}
          value={v.amount}
          onValueChange={(x) => form.setValue("amount", x)}
          error={fe.amount ?? (tooMuch ? fmt(t.atMost, { max: maxText }) : null)}
        />
        <TextInput label={t.date} type="date" required value={v.paidDate} onChange={(e) => form.setValue("paidDate", e.target.value)} error={fe.paidDate} />
        <Select label={t.method} value={v.method} onChange={(e) => form.setValue("method", e.target.value)} error={fe.method}>
          {methods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <TextInput label={t.reference} optional placeholder={t.referencePh} value={v.reference} onChange={(e) => form.setValue("reference", e.target.value)} error={fe.reference} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        {refund ? t.submitRefund : t.submit}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tuzatish (qabul qilingan / yopilgan reys) — sabab majburiy, audit saqlanadi
// ---------------------------------------------------------------------------
export interface CorrectionTargets {
  weighings: { weighingId: string; label: string; grossGrams: number; tareGrams: number }[];
  acceptance: { acceptedGrams: number } | null;
  expenses: { expenseId: string; label: string; amount: number }[];
}

export function CorrectionForm({ tripId, targets }: { tripId: string; targets: CorrectionTargets }) {
  const locale = useLocale();
  const t = OPERATOR_DICT[locale].correction;
  const formatKg = (g: number) => formatKgL(g, locale);
  const formatSom = (n: number) => formatSomL(n, locale);
  const firstTarget = targets.weighings[0] ? `W:${targets.weighings[0].weighingId}` : targets.acceptance ? "A" : targets.expenses[0] ? `E:${targets.expenses[0].expenseId}` : "";
  const [target, setTarget] = useState(firstTarget);
  const valuesFor = (key: string) => {
    const nw = targets.weighings.find((x) => `W:${x.weighingId}` === key);
    const ne = targets.expenses.find((x) => `E:${x.expenseId}` === key);
    return {
      grossKg: nw ? gramsToKgInput(nw.grossGrams) : "",
      tareKg: nw ? gramsToKgInput(nw.tareGrams) : "",
      acceptedKg: key === "A" && targets.acceptance ? gramsToKgInput(targets.acceptance.acceptedGrams) : "",
      amount: ne ? sanitizeSom(String(ne.amount)) : "",
    };
  };
  const form = useActionForm<{ grossKg: string; tareKg: string; acceptedKg: string; amount: string; reason: string }>({
    initialValues: { ...valuesFor(firstTarget), reason: "" },
    resetOnSuccess: false,
    successMessage: t.success,
  });
  const v = form.values;
  const fe = form.fieldErrors;

  const w = target.startsWith("W:") ? targets.weighings.find((x) => `W:${x.weighingId}` === target) : undefined;
  const ex = target.startsWith("E:") ? targets.expenses.find((x) => `E:${x.expenseId}` === target) : undefined;

  function pickTarget(key: string) {
    setTarget(key);
    form.patch(valuesFor(key));
  }

  if (!firstTarget) return <p className="text-muted">{t.nothing}</p>;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const reason = v.reason.trim();
        if (reason.length < 3) {
          form.fail(t.reasonFail, { reason: t.reasonField });
          return;
        }
        if (w) {
          if (parseKgToGrams(v.grossKg) === null) return form.fail(t.grossFail, { grossKg: t.grossField });
          void form.submit(() => correctRecord({ tripId, target: "WEIGHING", weighingId: w.weighingId, grossKg: v.grossKg, tareKg: v.tareKg.trim() || "0", reason }));
        } else if (target === "A") {
          if (parseKgToGrams(v.acceptedKg) === null) return form.fail(t.acceptedFail, { acceptedKg: t.acceptedField });
          void form.submit(() => correctRecord({ tripId, target: "ACCEPTANCE", acceptedKg: v.acceptedKg, reason }));
        } else if (ex) {
          const amount = parseSom(v.amount);
          if (amount === null) return form.fail(t.amountFail, { amount: t.amountField });
          void form.submit(() => correctRecord({ tripId, target: "EXPENSE", expenseId: ex.expenseId, amount, reason }));
        }
      }}
    >
      <Select label={t.what} value={target} onChange={(e) => pickTarget(e.target.value)}>
        {targets.weighings.map((x) => (
          <option key={x.weighingId} value={`W:${x.weighingId}`}>
            {fmt(t.weighing, { label: x.label })}
          </option>
        ))}
        {targets.acceptance ? <option value="A">{t.acceptance}</option> : null}
        {targets.expenses.map((x) => (
          <option key={x.expenseId} value={`E:${x.expenseId}`}>
            {fmt(t.expense, { label: x.label })}
          </option>
        ))}
      </Select>

      {w ? (
        <>
          <p className="text-sm text-muted tabular-nums">
            {fmt(t.currentWeighing, { gross: formatKg(w.grossGrams), tare: formatKg(w.tareGrams) })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <KgInput label={t.newGross} required value={v.grossKg} onValueChange={(x) => form.setValue("grossKg", x)} error={fe.grossKg} />
            <KgInput label={t.newTare} value={v.tareKg} onValueChange={(x) => form.setValue("tareKg", x)} error={fe.tareKg} />
          </div>
        </>
      ) : null}
      {target === "A" && targets.acceptance ? (
        <>
          <p className="text-sm text-muted tabular-nums">{fmt(t.current, { v: formatKg(targets.acceptance.acceptedGrams) })}</p>
          <KgInput label={t.newAccepted} required value={v.acceptedKg} onValueChange={(x) => form.setValue("acceptedKg", x)} error={fe.acceptedKg} />
        </>
      ) : null}
      {ex ? (
        <>
          <p className="text-sm text-muted tabular-nums">{fmt(t.current, { v: formatSom(ex.amount) })}</p>
          <SomInput label={t.newAmount} required value={v.amount} onValueChange={(x) => form.setValue("amount", x)} error={fe.amount} />
        </>
      ) : null}
      <Textarea label={t.reason} required value={v.reason} onChange={(e) => form.setValue("reason", e.target.value)} error={fe.reason} />
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        {t.submit}
      </Button>
    </form>
  );
}

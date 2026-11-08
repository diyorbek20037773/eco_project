"use client";

import { useState } from "react";
import type { DiscrepancyDecision, ExpenseType, ObligationDTO, Party, Quality } from "@/server/contract";
import { addExpense, correctRecord, recordAcceptance, recordPayment } from "@/server/actions/operator";
import {
  DISCREPANCY_DECISION_LABEL,
  EXPENSE_OPTIONS,
  EXPENSE_TYPE_LABEL,
  PARTY_LABEL,
  PARTY_OPTIONS,
  PAYMENT_METHODS,
  QUALITY_LABEL,
  QUALITY_OPTIONS,
} from "@/domain/labels";
import { parseSom } from "@/domain/money";
import { parseKgToGrams } from "@/domain/weight";
import { formatKg, formatSom, gramsToKgInput } from "@/lib/format";
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
    successMessage: (d) => (d.discrepancyGrams === 0 ? "Qabul saqlandi. Tafovut yo‘q." : `Qabul saqlandi. Tafovut: ${formatKg(d.discrepancyGrams)}.`),
  });
  const v = form.values;
  const fe = form.fieldErrors;
  const acceptedG = v.acceptedKg.trim() ? parseKgToGrams(v.acceptedKg) : null;
  const diff = acceptedG === null ? null : acceptedG - deliveredGrams;
  const hasDiff = diff !== null && diff !== 0;

  function validate() {
    const e: Record<string, string> = {};
    if (acceptedG === null || acceptedG <= 0) e.acceptedKg = "Qabul vaznini kg’da kiriting, masalan 470.";
    if (hasDiff) {
      if (v.discrepancyReason.trim().length < 3) e.discrepancyReason = "Tafovut bor — sababini yozing.";
      if (!v.decision) e.decision = "Tafovut bo‘yicha qaror tanlang.";
      if (v.decision === "OTHER" && v.decisionNote.trim().length < 3) e.decisionNote = "«Boshqa qaror» uchun izoh majburiy.";
    }
    if (parseSom(v.buyerPrice) === null) e.buyerPricePerKg = "Narxni butun so‘mda kiriting.";
    if (v.buyerReference.trim().length < 2) e.buyerReference = "Xaridor tasdig‘ini yozing: nakladnoy raqami yoki qabul qilgan shaxs.";
    if (!v.acceptedDate) e.acceptedDate = "Sanani kiriting.";
    if (!/^\d{2}:\d{2}$/.test(v.acceptedTime)) e.acceptedTime = "Vaqtni kiriting.";
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
          form.fail("Qabul formasida xato bor — belgilangan maydonlarni tuzating.", e);
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
      <Notice tone="info">
        Xaridor bergan qabul tasdig‘i asosida kiriting. Bu «qayta ishlandi» degani emas — faqat xaridor qabul qilgan vazn.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <KgInput
          label="Qabul vazni"
          required
          hint={`Topshirishlar yig‘indisi: ${formatKg(deliveredGrams)}`}
          value={v.acceptedKg}
          onValueChange={(x) => form.setValue("acceptedKg", x)}
          error={fe.acceptedKg}
        />
        <SomInput label="Xaridor narxi, 1 kg" required value={v.buyerPrice} onValueChange={(x) => form.setValue("buyerPrice", x)} error={fe.buyerPricePerKg} />
      </div>

      <div aria-live="polite">
        {diff !== null ? (
          hasDiff ? (
            <Notice tone="warning" title={`Tafovut: ${diff > 0 ? "+" : ""}${formatKg(diff)}`}>
              Aralash partiya tafovuti do‘konlarga avtomatik yozilmaydi. Sabab va qaror majburiy.
            </Notice>
          ) : (
            <Notice tone="success" title="Tafovut yo‘q">
              Qabul vazni topshirishlar yig‘indisiga teng.
            </Notice>
          )
        ) : null}
      </div>

      {hasDiff ? (
        <div className="space-y-3 rounded-xl border border-amber/40 bg-amber-soft/50 p-3">
          <Textarea
            label="Tafovut sababi"
            required
            placeholder="Masalan: namlik, aralashma, xaridor tarozisi farqi"
            value={v.discrepancyReason}
            onChange={(e) => form.setValue("discrepancyReason", e.target.value)}
            error={fe.discrepancyReason}
          />
          <ChoiceGroup
            legend="Operator qarori"
            name="decision"
            required
            value={v.decision}
            onChange={(x) => form.setValue("decision", x)}
            error={fe.decision}
            options={(["TRIP_ABSORBS", "OTHER"] as DiscrepancyDecision[]).map((d) => ({ value: d, label: DISCREPANCY_DECISION_LABEL[d] }))}
          />
          {v.decision === "OTHER" ? (
            <Textarea label="Qaror izohi" required value={v.decisionNote} onChange={(e) => form.setValue("decisionNote", e.target.value)} error={fe.decisionNote} />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Sifat" required value={v.quality} onChange={(e) => form.setValue("quality", e.target.value)} error={fe.quality}>
          {QUALITY_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABEL[q]}
            </option>
          ))}
        </Select>
        <TextInput label="Sifat izohi" optional value={v.qualityNote} onChange={(e) => form.setValue("qualityNote", e.target.value)} error={fe.qualityNote} />
      </div>

      <TextInput
        label="Xaridor tasdig‘i"
        required
        hint="Nakladnoy raqami yoki qabul qilgan shaxs ismi"
        value={v.buyerReference}
        onChange={(e) => form.setValue("buyerReference", e.target.value)}
        error={fe.buyerReference}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Qabul sanasi" type="date" required value={v.acceptedDate} onChange={(e) => form.setValue("acceptedDate", e.target.value)} error={fe.acceptedDate} />
        <TextInput label="Vaqti" type="time" required value={v.acceptedTime} onChange={(e) => form.setValue("acceptedTime", e.target.value)} error={fe.acceptedTime} />
      </div>
      <PhotoInput
        kind="ACCEPTANCE_DOC"
        label="Qabul hujjati yoki rasmi"
        value={v.docId || null}
        onChange={(id) => form.setValue("docId", id ?? "")}
        onUploadingChange={setUploading}
      />
      <FormStatus form={form} only="result" />
      <Button type="submit" size="lg" loading={form.pending} disabled={uploading}>
        Qabulni saqlash
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Xarajat
// ---------------------------------------------------------------------------
export function ExpenseForm({ tripId }: { tripId: string }) {
  const form = useActionForm<{ type: string; amount: string; payer: string; recipient: string; note: string }, { expenseId: string }>({
    draftKey: `expense:${tripId}`,
    initialValues: { type: "TRANSPORT", amount: "", payer: "COLLECTOR", recipient: "", note: "" },
    successMessage: "Xarajat qo‘shildi.",
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
          form.fail("Summani butun so‘mda kiriting.", { amount: "Summa 0 dan katta bo‘lsin." });
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
        <Select label="Turi" required value={v.type} onChange={(e) => form.setValue("type", e.target.value)} error={fe.type}>
          {EXPENSE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {EXPENSE_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <SomInput label="Summa" required value={v.amount} onValueChange={(x) => form.setValue("amount", x)} error={fe.amount} />
        <Select label="To‘lovchi" required value={v.payer} onChange={(e) => form.setValue("payer", e.target.value)} error={fe.payer}>
          {PARTY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PARTY_LABEL[p]}
            </option>
          ))}
        </Select>
        <TextInput label="Oluvchi" optional placeholder="Masalan: haydovchi Sardor" value={v.recipient} onChange={(e) => form.setValue("recipient", e.target.value)} error={fe.recipient} />
      </div>
      <TextInput label="Izoh" optional value={v.note} onChange={(e) => form.setValue("note", e.target.value)} error={fe.note} />
      <FormStatus form={form} only="result" />
      <Button type="submit" loading={form.pending}>
        Xarajatni qo‘shish
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// To‘lov (qisman ham)
// ---------------------------------------------------------------------------
export function PaymentForm({ obligation, today }: { obligation: ObligationDTO; today: string }) {
  const refund = obligation.remaining < 0;
  const max = Math.abs(obligation.remaining);
  const form = useActionForm<{ amount: string; paidDate: string; method: string; reference: string }, { paymentId: string; remaining: number }>({
    draftKey: `payment:${obligation.id}`,
    initialValues: { amount: sanitizeSom(String(max)), paidDate: today, method: PAYMENT_METHODS[0], reference: "" },
    successMessage: (d) => (d.remaining === 0 ? "To‘lov qayd etildi. Qoldiq: 0 so‘m." : `To‘lov qayd etildi. Qoldiq: ${formatSom(d.remaining)}.`),
  });
  const v = form.values;
  const fe = form.fieldErrors;
  const amount = parseSom(v.amount);
  const tooMuch = amount !== null && amount > max;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (amount === null || amount <= 0) {
          form.fail("Summani butun so‘mda kiriting.", { amount: "Summa 0 dan katta bo‘lsin." });
          return;
        }
        if (tooMuch) {
          form.fail(`Summa qoldiqdan (${formatSom(max)}) katta. Ortiqcha to‘lov qabul qilinmaydi.`, { amount: `Ko‘pi bilan ${formatSom(max)}.` });
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
      {refund ? <Notice tone="warning">Ortiqcha to‘langan: {formatSom(max)}. Faqat qaytarishni qayd etish mumkin.</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <SomInput
          label={refund ? "Qaytarilgan summa" : "To‘langan summa"}
          required
          hint={`Qoldiq: ${formatSom(max)}. Qisman to‘lov mumkin.`}
          value={v.amount}
          onValueChange={(x) => form.setValue("amount", x)}
          error={fe.amount ?? (tooMuch ? `Ko‘pi bilan ${formatSom(max)}.` : null)}
        />
        <TextInput label="Sana" type="date" required value={v.paidDate} onChange={(e) => form.setValue("paidDate", e.target.value)} error={fe.paidDate} />
        <Select label="Usul" value={v.method} onChange={(e) => form.setValue("method", e.target.value)} error={fe.method}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <TextInput label="Ma’lumot" optional placeholder="Chek yoki o‘tkazma raqami" value={v.reference} onChange={(e) => form.setValue("reference", e.target.value)} error={fe.reference} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        {refund ? "Qaytarishni qayd etish" : "To‘lovni qayd etish"}
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
  const firstTarget = targets.weighings[0] ? `W:${targets.weighings[0].weighingId}` : targets.acceptance ? "A" : targets.expenses[0] ? `E:${targets.expenses[0].expenseId}` : "";
  const [target, setTarget] = useState(firstTarget);
  const valuesFor = (t: string) => {
    const nw = targets.weighings.find((x) => `W:${x.weighingId}` === t);
    const ne = targets.expenses.find((x) => `E:${x.expenseId}` === t);
    return {
      grossKg: nw ? gramsToKgInput(nw.grossGrams) : "",
      tareKg: nw ? gramsToKgInput(nw.tareGrams) : "",
      acceptedKg: t === "A" && targets.acceptance ? gramsToKgInput(targets.acceptance.acceptedGrams) : "",
      amount: ne ? sanitizeSom(String(ne.amount)) : "",
    };
  };
  const form = useActionForm<{ grossKg: string; tareKg: string; acceptedKg: string; amount: string; reason: string }>({
    initialValues: { ...valuesFor(firstTarget), reason: "" },
    resetOnSuccess: false,
    successMessage: "Tuzatish saqlandi. Avvalgi va yangi qiymat auditda, balans qayta hisoblandi.",
  });
  const v = form.values;
  const fe = form.fieldErrors;

  const w = target.startsWith("W:") ? targets.weighings.find((x) => `W:${x.weighingId}` === target) : undefined;
  const ex = target.startsWith("E:") ? targets.expenses.find((x) => `E:${x.expenseId}` === target) : undefined;

  function pickTarget(t: string) {
    setTarget(t);
    form.patch(valuesFor(t));
  }

  if (!firstTarget) return <p className="text-muted">Tuzatiladigan yozuv yo‘q.</p>;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const reason = v.reason.trim();
        if (reason.length < 3) {
          form.fail("Tuzatish sababi majburiy.", { reason: "Sababni yozing." });
          return;
        }
        if (w) {
          if (parseKgToGrams(v.grossKg) === null) return form.fail("Bruttoni kiriting.", { grossKg: "Brutto majburiy." });
          void form.submit(() => correctRecord({ tripId, target: "WEIGHING", weighingId: w.weighingId, grossKg: v.grossKg, tareKg: v.tareKg.trim() || "0", reason }));
        } else if (target === "A") {
          if (parseKgToGrams(v.acceptedKg) === null) return form.fail("Qabul vaznini kiriting.", { acceptedKg: "Qabul vazni majburiy." });
          void form.submit(() => correctRecord({ tripId, target: "ACCEPTANCE", acceptedKg: v.acceptedKg, reason }));
        } else if (ex) {
          const amount = parseSom(v.amount);
          if (amount === null) return form.fail("Summani kiriting.", { amount: "Summa majburiy." });
          void form.submit(() => correctRecord({ tripId, target: "EXPENSE", expenseId: ex.expenseId, amount, reason }));
        }
      }}
    >
      <Select label="Nimani tuzatamiz?" value={target} onChange={(e) => pickTarget(e.target.value)}>
        {targets.weighings.map((x) => (
          <option key={x.weighingId} value={`W:${x.weighingId}`}>
            Tortish — {x.label}
          </option>
        ))}
        {targets.acceptance ? <option value="A">Xaridor qabul vazni</option> : null}
        {targets.expenses.map((x) => (
          <option key={x.expenseId} value={`E:${x.expenseId}`}>
            Xarajat — {x.label}
          </option>
        ))}
      </Select>

      {w ? (
        <>
          <p className="text-sm text-muted tabular-nums">
            Hozirgi: brutto {formatKg(w.grossGrams)}, tara {formatKg(w.tareGrams)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <KgInput label="Yangi brutto" required value={v.grossKg} onValueChange={(x) => form.setValue("grossKg", x)} error={fe.grossKg} />
            <KgInput label="Yangi tara" value={v.tareKg} onValueChange={(x) => form.setValue("tareKg", x)} error={fe.tareKg} />
          </div>
        </>
      ) : null}
      {target === "A" && targets.acceptance ? (
        <>
          <p className="text-sm text-muted tabular-nums">Hozirgi: {formatKg(targets.acceptance.acceptedGrams)}</p>
          <KgInput label="Yangi qabul vazni" required value={v.acceptedKg} onValueChange={(x) => form.setValue("acceptedKg", x)} error={fe.acceptedKg} />
        </>
      ) : null}
      {ex ? (
        <>
          <p className="text-sm text-muted tabular-nums">Hozirgi: {formatSom(ex.amount)}</p>
          <SomInput label="Yangi summa" required value={v.amount} onValueChange={(x) => form.setValue("amount", x)} error={fe.amount} />
        </>
      ) : null}
      <Textarea label="Tuzatish sababi" required value={v.reason} onChange={(e) => form.setValue("reason", e.target.value)} error={fe.reason} />
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        Tuzatishni saqlash
      </Button>
    </form>
  );
}

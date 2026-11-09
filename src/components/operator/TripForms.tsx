"use client";

import { useState } from "react";
import type { CloseCheck, StopDTO, TripStatus } from "@/server/contract";
import { cancelTrip, closeTrip, decideDispute, reorderTripStops } from "@/server/actions/operator";
import { fmt } from "@/i18n/config";
import { labelsFor } from "@/i18n/labels";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { OPERATOR_DICT } from "@/i18n/operator";
import { parseKgToGrams } from "@/domain/weight";
import { gramsToKgInput } from "@/lib/format";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { KgInput, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { IconArrowDown, IconArrowUp, IconCheck, IconX } from "@/components/ui/icons";

/** Rejalashtirilgan reys: bekatlar tartibi va olib tashlash. */
export function StopsEditor({ tripId, stops }: { tripId: string; stops: StopDTO[] }) {
  const d = useDict(OPERATOR_DICT);
  const t = d.tripForms;
  const initial = stops.map((s) => s.request.id);
  const [order, setOrder] = useState<string[]>(initial);
  const byReq = new Map(stops.map((s) => [s.request.id, s]));
  const changed = order.join(",") !== initial.join(",");
  const form = useActionForm<Record<string, never>>({ initialValues: {}, successMessage: t.reorderSuccess });

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const copy = [...order];
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
    setOrder(copy);
  }
  const removed = initial.filter((id) => !order.includes(id));

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {order.map((rid, i) => {
          const s = byReq.get(rid);
          if (!s) return null;
          return (
            <li key={rid} className="flex items-center gap-2 rounded-xl border border-line bg-canvas p-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kraft font-bold tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold">
                  №{s.request.number} · {s.point.shopName}
                </span>
                <span className="block text-muted">{s.point.address}</span>
              </span>
              <Button size="sm" variant="ghost" className="px-2" aria-label={fmt(d.common.moveUp, { n: s.request.number })} disabled={i === 0} onClick={() => move(i, -1)}>
                <IconArrowUp size={18} />
              </Button>
              <Button size="sm" variant="ghost" className="px-2" aria-label={fmt(d.common.moveDown, { n: s.request.number })} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <IconArrowDown size={18} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="px-2 text-danger"
                aria-label={fmt(d.common.removeFromTrip, { n: s.request.number })}
                disabled={order.length === 1}
                onClick={() => setOrder(order.filter((x) => x !== rid))}
              >
                <IconX size={18} />
              </Button>
            </li>
          );
        })}
      </ol>
      {removed.length > 0 ? (
        <p className="text-sm text-amber">{fmt(t.removedCount, { n: removed.length })}</p>
      ) : null}
      <FormStatus form={form} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!changed} loading={form.pending} onClick={() => void form.submit(() => reorderTripStops({ tripId, requestIds: order }))}>
          {t.saveOrder}
        </Button>
        {changed ? (
          <Button variant="ghost" onClick={() => setOrder(initial)} disabled={form.pending}>
            {t.cancel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CancelTripForm({ tripId }: { tripId: string }) {
  const t = useDict(OPERATOR_DICT).tripForms;
  const [open, setOpen] = useState(false);
  const form = useActionForm<{ reason: string }>({
    initialValues: { reason: "" },
    draftKey: `cancel-trip:${tripId}`,
    successMessage: t.cancelSuccess,
  });
  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t.cancelTrip}
      </Button>
    );
  }
  return (
    <form noValidate className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const reason = form.values.reason.trim();
        if (reason.length < 3) {
          form.fail(t.cancelReasonRequired, { reason: t.reasonRequired });
          return;
        }
        void form.submit(() => cancelTrip({ tripId, reason }));
      }}
    >
      <Textarea label={t.cancelReason} required value={form.values.reason} onChange={(e) => form.setValue("reason", e.target.value)} error={form.fieldErrors.reason} />
      <FormStatus form={form} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" loading={form.pending}>
          {t.confirmCancel}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={form.pending}>
          {t.no}
        </Button>
      </div>
    </form>
  );
}

/** Ochiq bahs bo‘yicha operator qarori: matn + yakuniy sof vazn. */
export function DecideDisputeForm({ disputeId, suggestedGrams }: { disputeId: string; suggestedGrams: number | null }) {
  const t = useDict(OPERATOR_DICT).tripForms;
  const form = useActionForm<{ decisionText: string; decidedKg: string }>({
    draftKey: `decide:${disputeId}`,
    initialValues: { decisionText: "", decidedKg: suggestedGrams !== null ? gramsToKgInput(suggestedGrams) : "" },
    successMessage: t.decideSuccess,
  });
  const kg = form.values.decidedKg.trim();
  const kgError = kg && parseKgToGrams(kg) === null ? t.kgFormat : null;
  return (
    <form noValidate className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const text = form.values.decisionText.trim();
        const errors: Record<string, string> = {};
        if (text.length < 5) errors.decisionText = t.decisionTextErr;
        const g = parseKgToGrams(kg);
        if (g === null || g <= 0) errors.decidedKg = t.decidedKgErr;
        if (Object.keys(errors).length) {
          form.fail(t.decideFail, errors);
          return;
        }
        void form.submit(() => decideDispute({ disputeId, decisionText: text, decidedKg: kg }));
      }}
    >
      <Textarea
        label={t.decision}
        required
        placeholder={t.decisionPh}
        value={form.values.decisionText}
        onChange={(e) => form.setValue("decisionText", e.target.value)}
        error={form.fieldErrors.decisionText}
      />
      <KgInput label={t.decidedKg} required value={form.values.decidedKg} onValueChange={(x) => form.setValue("decidedKg", x)} error={form.fieldErrors.decidedKg ?? kgError} />
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        {t.saveDecision}
      </Button>
    </form>
  );
}

/** Reysni yopish: natija — Yopildi yoki To‘lov kutilmoqda (+ bajarilmagan shartlar). */
export function CloseTripPanel({ tripId, checks, canClose }: { tripId: string; checks: CloseCheck[]; canClose: boolean }) {
  const locale = useLocale();
  const dict = OPERATOR_DICT[locale];
  const t = dict.tripForms;
  // Server yuborgan `label` o‘rniga `key` bo‘yicha o‘z lug‘atimizdan (docs/i18n.md 8-qoida).
  const checkLabel = (c: CloseCheck) => dict.closeChecks[c.key];
  const [outcome, setOutcome] = useState<{ status: TripStatus; failed: CloseCheck[] } | null>(null);
  const form = useActionForm<Record<string, never>, { status: TripStatus; failed: CloseCheck[] }>({
    initialValues: {},
    successMessage: (d) => (d.status === "CLOSED" ? t.closed : fmt(t.statusNow, { s: labelsFor(locale).tripStatus[d.status] })),
    onSuccess: (d) => setOutcome(d),
  });
  const blocking = checks.filter((c) => !c.ok && c.key !== "PAID");

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5" aria-label={t.checksLabel}>
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={c.ok ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white" : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber"}
            >
              {c.ok ? <IconCheck size={14} /> : "!"}
            </span>
            <span className="min-w-0">
              <span className="font-semibold">{c.ok ? t.done : t.notDone}:</span> {checkLabel(c)}
            </span>
          </li>
        ))}
      </ul>

      {outcome ? (
        <Notice tone={outcome.status === "CLOSED" ? "success" : "warning"} live="polite" title={outcome.status === "CLOSED" ? t.closedTitle : t.awaitingTitle}>
          {outcome.status === "CLOSED"
            ? t.closedText
            : outcome.failed.length
              ? fmt(t.remainingChecks, { list: outcome.failed.map(checkLabel).join("; ") })
              : t.payThenClose}
        </Notice>
      ) : null}

      {canClose ? (
        <>
          {blocking.length > 0 ? (
            <p className="text-sm text-muted">{t.blockingHint}</p>
          ) : null}
          <FormStatus form={form} hideSuccess={outcome !== null} />
          <Button size="lg" loading={form.pending} onClick={() => void form.submit(() => closeTrip({ tripId }))}>
            {t.closeTrip}
          </Button>
        </>
      ) : null}
    </div>
  );
}

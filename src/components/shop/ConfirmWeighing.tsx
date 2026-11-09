"use client";

import { useState } from "react";
import { confirmStopWeight, disputeStopWeight } from "@/server/actions/shop";
import { parseKgToGrams } from "@/domain/weight";
import { formatKgL } from "@/lib/format";
import { fmt } from "@/i18n/config";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { KgInput, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { IconAlert, IconCheck } from "@/components/ui/icons";

/** Do‘kon o‘z vaznini tasdiqlaydi yoki sabab bilan e’tiroz bildiradi. */
export function ConfirmWeighing({ stopId, netGrams }: { stopId: string; netGrams: number | null }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).confirm;
  const [mode, setMode] = useState<"choose" | "dispute">("choose");
  const [done, setDone] = useState<null | "confirmed" | "disputed">(null);

  const confirm = useActionForm<Record<string, never>>({
    initialValues: {},
    successMessage: t.confirmedMsg,
    onSuccess: () => setDone("confirmed"),
  });

  const dispute = useActionForm<{ reason: string; claimedKg: string }, { disputeId: string }>({
    initialValues: { reason: "", claimedKg: "" },
    draftKey: `dispute:${stopId}`,
    successMessage: t.disputedMsg,
    onSuccess: () => setDone("disputed"),
  });

  if (done) {
    return (
      <Notice tone={done === "confirmed" ? "success" : "warning"} live="polite" title={done === "confirmed" ? t.confirmedTitle : t.disputedTitle}>
        {done === "confirmed" ? t.confirmedBody : t.disputedBody}
      </Notice>
    );
  }

  if (mode === "dispute") {
    const claimed = dispute.values.claimedKg.trim();
    const claimedError = claimed && parseKgToGrams(claimed) === null ? t.errKg : null;
    return (
      <form noValidate className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const reason = dispute.values.reason.trim();
          if (reason.length < 3) {
            dispute.fail(t.errReason, { reason: t.errReasonField });
            return;
          }
          if (claimedError) {
            dispute.fail(claimedError, { claimedKg: claimedError });
            return;
          }
          void dispute.submit(() => disputeStopWeight({ stopId, reason, claimedKg: claimed || undefined }));
        }}
      >
        <Textarea
          label={t.reason}
          required
          value={dispute.values.reason}
          onChange={(e) => dispute.setValue("reason", e.target.value)}
          error={dispute.fieldErrors.reason}
          placeholder={t.reasonPlaceholder}
        />
        <KgInput
          label={t.claimed}
          optional
          hint={netGrams !== null ? fmt(t.claimedHint, { kg: formatKgL(netGrams, locale) }) : undefined}
          value={dispute.values.claimedKg}
          onValueChange={(v) => dispute.setValue("claimedKg", v)}
          error={dispute.fieldErrors.claimedKg ?? claimedError}
        />
        <FormStatus form={dispute} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="danger" size="lg" loading={dispute.pending} icon={<IconAlert />}>
            {t.send}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setMode("choose")} disabled={dispute.pending}>
            {t.back}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <FormStatus form={confirm} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          loading={confirm.pending}
          icon={<IconCheck />}
          onClick={() => void confirm.submit(() => confirmStopWeight({ stopId }))}
        >
          {t.confirm}
        </Button>
        <Button size="lg" variant="danger" icon={<IconAlert />} onClick={() => setMode("dispute")} disabled={confirm.pending}>
          {t.dispute}
        </Button>
      </div>
    </div>
  );
}

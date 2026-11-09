"use client";

import { useState } from "react";
import type { DisputeDTO, DisputeStatus } from "@/server/contract";
import { acknowledgeDispute } from "@/server/actions/shop";
import { uzText } from "@/domain/labels";
import { formatKgL } from "@/lib/format";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Card, KeyValues } from "@/components/ui/Card";
import { DisputeFlag } from "@/components/ui/StatusBadge";
import { Notice } from "@/components/ui/States";
import { IconCheck, IconX } from "@/components/ui/icons";

/** Operator qaroriga rozilik (do‘kon yoki yig‘uvchi). Rozi bo‘lmasa izoh majburiy — bahs qayta ochiladi. */
export function DisputeAck({ dispute, context }: { dispute: DisputeDTO; context: string }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).ack;
  const [mode, setMode] = useState<"choose" | "reject">("choose");
  const [result, setResult] = useState<DisputeStatus | "rejected" | null>(null);

  const agree = useActionForm<Record<string, never>, { status: DisputeStatus }>({
    initialValues: {},
    successMessage: (d) => (d.status === "RESOLVED" ? t.resolvedMsg : t.ackMsg),
    onSuccess: (d) => setResult(d.status),
  });
  const reject = useActionForm<{ comment: string }, { status: DisputeStatus }>({
    initialValues: { comment: "" },
    draftKey: `dispute-ack:${dispute.id}`,
    successMessage: t.rejectMsg,
    onSuccess: () => setResult("rejected"),
  });

  return (
    <Card tone="danger" as="article" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DisputeFlag>{t.flag}</DisputeFlag>
        <span className="font-semibold">{context}</span>
      </div>
      <KeyValues
        rows={[
          { label: t.reason, value: <span className="font-normal">{uzText(dispute.reason)}</span> },
          ...(dispute.claimedNetGrams !== null ? [{ label: t.claimed, value: formatKgL(dispute.claimedNetGrams, locale) }] : []),
          { label: t.decision, value: <span className="font-normal">{uzText(dispute.decisionText ?? "—")}</span> },
          ...(dispute.decidedNetGrams !== null ? [{ label: t.final, value: formatKgL(dispute.decidedNetGrams, locale), strong: true }] : []),
        ]}
      />

      {result ? (
        <Notice tone={result === "rejected" ? "warning" : "success"} live="polite" title={result === "rejected" ? t.rejectedTitle : t.ackTitle}>
          {result === "RESOLVED" ? t.resolvedBody : result === "rejected" ? t.rejectedBody : t.waitingBody}
        </Notice>
      ) : mode === "reject" ? (
        <form noValidate className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const comment = reject.values.comment.trim();
            if (comment.length < 3) {
              reject.fail(t.errComment, { comment: t.errCommentField });
              return;
            }
            void reject.submit(() => acknowledgeDispute({ disputeId: dispute.id, agree: false, comment }));
          }}
        >
          <Textarea
            label={t.commentLabel}
            required
            value={reject.values.comment}
            onChange={(e) => reject.setValue("comment", e.target.value)}
            error={reject.fieldErrors.comment}
          />
          <FormStatus form={reject} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="danger" loading={reject.pending}>
              {t.send}
            </Button>
            <Button variant="ghost" onClick={() => setMode("choose")} disabled={reject.pending}>
              {t.back}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <FormStatus form={agree} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              loading={agree.pending}
              icon={<IconCheck />}
              onClick={() => void agree.submit(() => acknowledgeDispute({ disputeId: dispute.id, agree: true }))}
            >
              {t.agree}
            </Button>
            <Button variant="danger" icon={<IconX />} onClick={() => setMode("reject")} disabled={agree.pending}>
              {t.disagree}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

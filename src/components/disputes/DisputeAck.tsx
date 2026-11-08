"use client";

import { useState } from "react";
import type { DisputeDTO, DisputeStatus } from "@/server/contract";
import { acknowledgeDispute } from "@/server/actions/shop";
import { uzText } from "@/domain/labels";
import { formatKg } from "@/lib/format";
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
  const [mode, setMode] = useState<"choose" | "reject">("choose");
  const [result, setResult] = useState<DisputeStatus | "rejected" | null>(null);

  const agree = useActionForm<Record<string, never>, { status: DisputeStatus }>({
    initialValues: {},
    successMessage: (d) => (d.status === "RESOLVED" ? "Bahs yopildi — hisob yakuniy vazn bo‘yicha qayta hisoblanadi." : "Roziligingiz qayd etildi. Ikkinchi tomon roziligi kutilmoqda."),
    onSuccess: (d) => setResult(d.status),
  });
  const reject = useActionForm<{ comment: string }, { status: DisputeStatus }>({
    initialValues: { comment: "" },
    draftKey: `dispute-ack:${dispute.id}`,
    successMessage: "Javobingiz yuborildi. Bahs qayta ko‘rib chiqiladi.",
    onSuccess: () => setResult("rejected"),
  });

  return (
    <Card tone="danger" as="article" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DisputeFlag>Bahs: qaror chiqdi</DisputeFlag>
        <span className="font-semibold">{context}</span>
      </div>
      <KeyValues
        rows={[
          { label: "E’tiroz sababi", value: <span className="font-normal">{uzText(dispute.reason)}</span> },
          ...(dispute.claimedNetGrams !== null ? [{ label: "Da’vo qilingan vazn", value: formatKg(dispute.claimedNetGrams) }] : []),
          { label: "Operator qarori", value: <span className="font-normal">{uzText(dispute.decisionText ?? "—")}</span> },
          ...(dispute.decidedNetGrams !== null ? [{ label: "Yakuniy sof vazn", value: formatKg(dispute.decidedNetGrams), strong: true }] : []),
        ]}
      />

      {result ? (
        <Notice tone={result === "rejected" ? "warning" : "success"} live="polite" title={result === "rejected" ? "Rozi emasligingiz yuborildi" : "Roziligingiz qayd etildi"}>
          {result === "RESOLVED" ? "Bahs yopildi, hisob yakuniy vazn bo‘yicha qayta hisoblanadi." : result === "rejected" ? "Operator bahsni qayta ko‘radi." : "Ikkinchi tomon roziligi kutilmoqda."}
        </Notice>
      ) : mode === "reject" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const comment = reject.values.comment.trim();
            if (comment.length < 3) {
              reject.fail("Nima uchun rozi emasligingizni yozing.", { comment: "Izoh majburiy." });
              return;
            }
            void reject.submit(() => acknowledgeDispute({ disputeId: dispute.id, agree: false, comment }));
          }}
        >
          <Textarea
            label="Nima uchun rozi emassiz?"
            required
            value={reject.values.comment}
            onChange={(e) => reject.setValue("comment", e.target.value)}
            error={reject.fieldErrors.comment}
          />
          <FormStatus form={reject} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="danger" loading={reject.pending}>
              Javobni yuborish
            </Button>
            <Button variant="ghost" onClick={() => setMode("choose")} disabled={reject.pending}>
              Orqaga
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
              Roziman
            </Button>
            <Button variant="danger" icon={<IconX />} onClick={() => setMode("reject")} disabled={agree.pending}>
              Rozi emasman
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

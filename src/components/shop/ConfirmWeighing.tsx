"use client";

import { useState } from "react";
import { confirmStopWeight, disputeStopWeight } from "@/server/actions/shop";
import { parseKgToGrams } from "@/domain/weight";
import { formatKg } from "@/lib/format";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { KgInput, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { IconAlert, IconCheck } from "@/components/ui/icons";

/** Do‘kon o‘z vaznini tasdiqlaydi yoki sabab bilan e’tiroz bildiradi. */
export function ConfirmWeighing({ stopId, netGrams }: { stopId: string; netGrams: number | null }) {
  const [mode, setMode] = useState<"choose" | "dispute">("choose");
  const [done, setDone] = useState<null | "confirmed" | "disputed">(null);

  const confirm = useActionForm<Record<string, never>>({
    initialValues: {},
    successMessage: "Vazn tasdiqlandi. Rahmat!",
    onSuccess: () => setDone("confirmed"),
  });

  const dispute = useActionForm<{ reason: string; claimedKg: string }, { disputeId: string }>({
    initialValues: { reason: "", claimedKg: "" },
    draftKey: `dispute:${stopId}`,
    successMessage: "E’tiroz yuborildi. Operator ko‘rib chiqib qaror chiqaradi.",
    onSuccess: () => setDone("disputed"),
  });

  if (done) {
    return (
      <Notice tone={done === "confirmed" ? "success" : "warning"} live="polite" title={done === "confirmed" ? "Vazn tasdiqlandi" : "E’tiroz yuborildi"}>
        {done === "confirmed"
          ? "Summa xaridor qabulidan keyin kvitansiyada ko‘rinadi."
          : "Operator qarorini shu sahifada ko‘rasiz va unga rozilik bildirasiz."}
      </Notice>
    );
  }

  if (mode === "dispute") {
    const claimed = dispute.values.claimedKg.trim();
    const claimedError = claimed && parseKgToGrams(claimed) === null ? "Vaznni raqamda kiriting, masalan 175,5." : null;
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const reason = dispute.values.reason.trim();
          if (reason.length < 3) {
            dispute.fail("E’tiroz sababini yozing.", { reason: "Sababni yozing: masalan, «biz 190 kg tortgan edik»." });
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
          label="E’tiroz sababi"
          required
          value={dispute.values.reason}
          onChange={(e) => dispute.setValue("reason", e.target.value)}
          error={dispute.fieldErrors.reason}
          placeholder="Masalan: bizning tarozimizda 190 kg chiqdi"
        />
        <KgInput
          label="Sizningcha sof vazn"
          optional
          hint={netGrams !== null ? `Yig‘uvchi kiritgan: ${formatKg(netGrams)}` : undefined}
          value={dispute.values.claimedKg}
          onValueChange={(v) => dispute.setValue("claimedKg", v)}
          error={dispute.fieldErrors.claimedKg ?? claimedError}
        />
        <FormStatus form={dispute} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="danger" size="lg" loading={dispute.pending} icon={<IconAlert />}>
            E’tirozni yuborish
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setMode("choose")} disabled={dispute.pending}>
            Orqaga
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
          Tasdiqlayman
        </Button>
        <Button size="lg" variant="danger" icon={<IconAlert />} onClick={() => setMode("dispute")} disabled={confirm.pending}>
          E’tiroz bildirish
        </Button>
      </div>
    </div>
  );
}

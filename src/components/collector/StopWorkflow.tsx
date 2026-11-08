"use client";

import { useState } from "react";
import { recordWeighing, skipStop } from "@/server/actions/collector";
import { computeNet, NET_ERROR_TEXT, parseKgToGrams } from "@/domain/weight";
import { SKIP_REASONS, uzText } from "@/domain/labels";
import { formatKg } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button, LinkButton } from "@/components/ui/Button";
import { ChoiceGroup, KgInput, Textarea } from "@/components/ui/Field";
import { PhotoInput } from "@/components/ui/PhotoInput";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/States";
import { IconChevronRight, IconScale } from "@/components/ui/icons";

type Done = { kind: "weighed"; netGrams: number; nextStopId: string | null } | { kind: "skipped"; nextStopId: string | null };

/**
 * Bekatdagi ish oqimi: tortish formasi (brutto, tara → jonli sof vazn), yoki «Karton tayyor emas».
 * Saqlangach — natija va «Keyingi nuqta» tugmasi (sahifa yangilansa ham shu komponent turadi).
 */
export function StopWorkflow({ stopId, canRecord, tripId }: { stopId: string; canRecord: boolean; tripId: string }) {
  const [mode, setMode] = useState<"weigh" | "skip">("weigh");
  const [done, setDone] = useState<Done | null>(null);

  if (done) {
    return (
      <>
        <Notice tone={done.kind === "weighed" ? "success" : "warning"} live="polite" title={done.kind === "weighed" ? `Saqlandi: ${formatKg(done.netGrams)}` : "Nuqta qoldirildi"}>
          {done.nextStopId ? "Keyingi nuqtaga o‘ting." : "Reys yakunlandi: barcha nuqtalar bajarildi. Kartonni xaridorga topshiring."}
        </Notice>
        <StickyActionBar>
          {done.nextStopId ? (
            <LinkButton href={routes.collector.stop(done.nextStopId)} size="lg" block icon={<IconChevronRight />}>
              Keyingi nuqta
            </LinkButton>
          ) : (
            <LinkButton href={routes.collector.trip(tripId)} size="lg" block>
              Reys yakunlandi — tafsilotlar
            </LinkButton>
          )}
        </StickyActionBar>
      </>
    );
  }

  if (!canRecord) return null;

  return mode === "weigh" ? (
    <WeighingForm stopId={stopId} onDone={setDone} onSkip={() => setMode("skip")} />
  ) : (
    <SkipForm stopId={stopId} onDone={setDone} onBack={() => setMode("weigh")} />
  );
}

function WeighingForm({ stopId, onDone, onSkip }: { stopId: string; onDone: (d: Done) => void; onSkip: () => void }) {
  const [uploading, setUploading] = useState(false);
  const form = useActionForm<{ grossKg: string; tareKg: string; photoId: string }, { netGrams: number; nextStopId: string | null }>({
    draftKey: `weigh:${stopId}`,
    initialValues: { grossKg: "", tareKg: "", photoId: "" },
    resetOnSuccess: false,
    onSuccess: (data) => onDone({ kind: "weighed", netGrams: data.netGrams, nextStopId: data.nextStopId }),
  });
  const { grossKg, tareKg } = form.values;

  const grossG = grossKg.trim() ? parseKgToGrams(grossKg) : null;
  const tareG = tareKg.trim() ? parseKgToGrams(tareKg) : 0;
  const grossParseError = grossKg.trim() !== "" && grossG === null;
  const tareParseError = tareKg.trim() !== "" && tareG === null;
  const net = computeNet(grossG, tareG);

  let grossError: string | null = null;
  let tareError: string | null = null;
  if (grossParseError) grossError = "Raqamni to‘g‘ri kiriting, masalan 182,4.";
  else if (tareParseError) tareError = "Raqamni to‘g‘ri kiriting, masalan 2,4.";
  else if (!net.ok && grossKg.trim() !== "") {
    const text = uzText(NET_ERROR_TEXT[net.error]);
    if (net.error === "TARE_EXCEEDS_GROSS" || net.error === "TARE_NEGATIVE" || net.error === "NET_ZERO") tareError = text;
    else grossError = text;
  }
  const canSubmit = net.ok && !tareParseError && !uploading;

  return (
    <form
      noValidate
      className="space-y-4 pb-36"
      onSubmit={form.handleSubmit(({ clientKey, values }) =>
        recordWeighing({
          stopId,
          clientKey,
          grossKg: values.grossKg,
          tareKg: values.tareKg.trim() || "0",
          photoAttachmentId: values.photoId || undefined,
        }),
      )}
    >
      <FormStatus form={form} only="draft" />
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <IconScale /> Tortish
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <KgInput
          label="Brutto"
          required
          value={grossKg}
          onValueChange={(x) => form.setValue("grossKg", x)}
          error={form.fieldErrors.grossKg ?? grossError}
          placeholder="182,4"
        />
        <KgInput
          label="Tara"
          hint="Qop, paddon va h.k."
          value={tareKg}
          onValueChange={(x) => form.setValue("tareKg", x)}
          error={form.fieldErrors.tareKg ?? tareError}
          placeholder="0"
        />
      </div>

      <Card tone={net.ok ? "primary" : "surface"} className="flex items-baseline justify-between gap-3 py-3">
        <span className="font-semibold">Sof vazn</span>
        <output aria-live="polite" className="text-3xl font-bold tabular-nums">
          {net.ok ? formatKg(net.netGrams) : "— kg"}
        </output>
      </Card>

      <PhotoInput
        kind="SCALE_PHOTO"
        label="Tarozi rasmi"
        hint="Tarozi ko‘rsatkichi ko‘rinib tursin."
        value={form.values.photoId || null}
        onChange={(id) => form.setValue("photoId", id ?? "")}
        onUploadingChange={setUploading}
      />

      <Button variant="secondary" block onClick={onSkip} disabled={form.pending}>
        Karton tayyor emas
      </Button>

      <FormStatus form={form} only="result" />

      <StickyActionBar>
        <Button type="submit" size="lg" block className="min-h-14" loading={form.pending} disabled={!canSubmit}>
          {uploading ? "Rasm yuklanmoqda…" : "Tortishni saqlash"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

function SkipForm({ stopId, onDone, onBack }: { stopId: string; onDone: (d: Done) => void; onBack: () => void }) {
  const form = useActionForm<{ reason: string; note: string }, { nextStopId: string | null }>({
    draftKey: `skip:${stopId}`,
    initialValues: { reason: SKIP_REASONS[0], note: "" },
    resetOnSuccess: false,
    onSuccess: (data) => onDone({ kind: "skipped", nextStopId: data.nextStopId }),
  });
  const isOther = form.values.reason === "Boshqa sabab";

  return (
    <form
      noValidate
      className="space-y-4 pb-36"
      onSubmit={(e) => {
        e.preventDefault();
        const note = form.values.note.trim();
        if (isOther && note.length < 3) {
          form.fail("Sababni yozing.", { note: "«Boshqa sabab» tanlansa izoh majburiy." });
          return;
        }
        const reason = isOther ? note : note ? `${form.values.reason}: ${note}` : form.values.reason;
        void form.submit(() => skipStop({ stopId, reason }));
      }}
    >
      <h2 className="text-lg font-bold">Nuqtani qoldirish</h2>
      <p className="text-muted">Buyurtma operator navbatiga qaytadi va boshqa reysga rejalashtiriladi.</p>
      <ChoiceGroup
        legend="Sabab"
        name="skipReason"
        required
        value={form.values.reason}
        onChange={(x) => form.setValue("reason", x)}
        options={SKIP_REASONS.map((r) => ({ value: r, label: r }))}
      />
      <Textarea
        label="Izoh"
        required={isOther}
        optional={!isOther}
        value={form.values.note}
        onChange={(e) => form.setValue("note", e.target.value)}
        error={form.fieldErrors.note ?? form.fieldErrors.reason}
        placeholder="Masalan: ertaga 10:00 dan keyin tayyor bo‘ladi"
      />
      <FormStatus form={form} only="result" />
      <StickyActionBar>
        <Button type="submit" size="lg" variant="danger" block className="min-h-14" loading={form.pending}>
          Qoldirishni tasdiqlash
        </Button>
        <Button variant="ghost" block onClick={onBack} disabled={form.pending}>
          Orqaga — tortishga
        </Button>
      </StickyActionBar>
    </form>
  );
}

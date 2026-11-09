"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PointDTO, VolumeSize } from "@/server/contract";
import { createPickupRequest } from "@/server/actions/shop";
import { VOLUME_OPTIONS } from "@/domain/labels";
import { labelsFor } from "@/i18n/labels";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { parseKgToGrams } from "@/domain/weight";
import { routes } from "@/lib/routes";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, KgInput, QuickChips, TextInput, Textarea } from "@/components/ui/Field";
import { PhotoInput } from "@/components/ui/PhotoInput";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Card } from "@/components/ui/Card";

const WINDOWS = [
  { key: "09:00-12:00", label: "09:00–12:00" },
  { key: "12:00-15:00", label: "12:00–15:00" },
  { key: "15:00-18:00", label: "15:00–18:00" },
];

type Values = {
  pointId: string;
  readyDate: string;
  fromTime: string;
  toTime: string;
  scale: "yes" | "no";
  estimatedKg: string;
  volume: string;
  note: string;
  photoId: string;
};

export function NewRequestForm({ points, today, tomorrow }: { points: PointDTO[]; today: string; tomorrow: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useDict(SHOP_DICT).form;
  const [uploading, setUploading] = useState(false);
  const form = useActionForm<Values, { requestId: string }>({
    draftKey: "shop-new-request",
    initialValues: {
      pointId: points.length === 1 ? (points[0]?.id ?? "") : "",
      readyDate: today,
      fromTime: "09:00",
      toTime: "12:00",
      scale: "no",
      estimatedKg: "",
      volume: "MEDIUM",
      note: "",
      photoId: "",
    },
    resetOnSuccess: false,
    flash: false,
    successMessage: t.successMsg,
    onSuccess: (data) => router.push(`${routes.shop.request(data.requestId)}?created=1`),
  });
  const v = form.values;
  const fe = form.fieldErrors;

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!v.pointId) errors.pointId = t.errPoint;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.readyDate)) errors.readyDate = t.errDate;
    else if (v.readyDate < today) errors.readyDate = t.errPast;
    if (!v.fromTime || !v.toTime) errors.toTime = t.errWindow;
    else if (v.toTime <= v.fromTime) errors.toTime = t.errWindowOrder;
    if (v.scale === "yes") {
      const g = parseKgToGrams(v.estimatedKg);
      if (g === null || g <= 0) errors.estimatedKg = t.errKg;
    } else if (!v.volume) {
      errors.volume = t.errVolume;
    }
    return errors;
  }

  return (
    <form
      noValidate
      className="space-y-5 pb-32"
      onSubmit={(e) => {
        e.preventDefault();
        const errors = validate();
        if (Object.keys(errors).length) {
          form.fail(t.errForm, errors);
          return;
        }
        void form.submit(({ clientKey, values }) =>
          createPickupRequest({
            clientKey,
            pointId: values.pointId,
            readyDate: values.readyDate,
            fromTime: values.fromTime,
            toTime: values.toTime,
            estimatedKg: values.scale === "yes" ? values.estimatedKg : undefined,
            volume: values.scale === "no" ? (values.volume as VolumeSize) : undefined,
            note: values.note.trim() || undefined,
            photoAttachmentId: values.photoId || undefined,
          }),
        );
      }}
    >
      <FormStatus form={form} only="draft" />

      {points.length === 1 && points[0] ? (
        <Card className="space-y-0.5">
          <p className="text-sm font-semibold text-muted">{t.point}</p>
          <p className="font-bold">{points[0].name}</p>
          <p className="text-sm text-muted">{points[0].address}</p>
        </Card>
      ) : (
        <ChoiceGroup
          legend={t.point}
          name="pointId"
          required
          value={v.pointId}
          onChange={(x) => form.setValue("pointId", x)}
          error={fe.pointId}
          options={points.map((p) => ({ value: p.id, label: p.name, description: `${p.address} · ${p.district}` }))}
        />
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {t.whenReady} <span className="text-danger">*</span>
        </p>
        <QuickChips
          label={t.date}
          options={[
            { key: today, label: t.today },
            { key: tomorrow, label: t.tomorrow },
          ]}
          isActive={(k) => v.readyDate === k}
          onPick={(k) => form.setValue("readyDate", k)}
        />
        <TextInput
          label={t.date}
          type="date"
          min={today}
          value={v.readyDate}
          onChange={(e) => form.setValue("readyDate", e.target.value)}
          error={fe.readyDate}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {t.window} <span className="text-danger">*</span>
        </p>
        <QuickChips
          label={t.quickWindow}
          options={WINDOWS}
          isActive={(k) => `${v.fromTime}-${v.toTime}` === k}
          onPick={(k) => {
            const [from = "", to = ""] = k.split("-");
            form.patch({ fromTime: from, toTime: to });
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t.from} type="time" step={900} value={v.fromTime} onChange={(e) => form.setValue("fromTime", e.target.value)} error={fe.fromTime} />
          <TextInput label={t.to} type="time" step={900} value={v.toTime} onChange={(e) => form.setValue("toTime", e.target.value)} error={fe.toTime} />
        </div>
      </div>

      <ChoiceGroup
        legend={t.scaleLegend}
        name="scale"
        columns={2}
        value={v.scale}
        onChange={(x) => form.setValue("scale", x)}
        options={[
          { value: "yes", label: t.scaleYes, description: t.scaleYesDesc },
          { value: "no", label: t.scaleNo, description: t.scaleNoDesc },
        ]}
      />

      {v.scale === "yes" ? (
        <KgInput
          label={t.estKg}
          required
          hint={t.estKgHint}
          value={v.estimatedKg}
          onValueChange={(x) => form.setValue("estimatedKg", x)}
          error={fe.estimatedKg}
        />
      ) : (
        <ChoiceGroup
          legend={t.volume}
          name="volume"
          required
          value={v.volume}
          onChange={(x) => form.setValue("volume", x)}
          error={fe.volume}
          options={VOLUME_OPTIONS.map((o) => ({ value: o, label: labelsFor(locale).volume[o] }))}
        />
      )}

      <PhotoInput
        kind="REQUEST_PHOTO"
        label={t.photo}
        hint={t.photoHint}
        value={v.photoId || null}
        onChange={(id) => form.setValue("photoId", id ?? "")}
        onUploadingChange={setUploading}
      />

      <Textarea
        label={t.note}
        optional
        placeholder={t.notePlaceholder}
        value={v.note}
        onChange={(e) => form.setValue("note", e.target.value)}
        error={fe.note}
      />

      <FormStatus form={form} only="result" success={t.success} />

      <StickyActionBar>
        <Button type="submit" size="lg" block loading={form.pending} disabled={uploading}>
          {uploading ? t.uploading : t.submit}
        </Button>
      </StickyActionBar>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PointDTO, VolumeSize } from "@/server/contract";
import { createPickupRequest } from "@/server/actions/shop";
import { VOLUME_LABEL, VOLUME_OPTIONS } from "@/domain/labels";
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
    successMessage: "Buyurtma yuborildi.",
    onSuccess: (data) => router.push(`${routes.shop.request(data.requestId)}?created=1`),
  });
  const v = form.values;
  const fe = form.fieldErrors;

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!v.pointId) errors.pointId = "Qaysi nuqtadan olib ketishni tanlang.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.readyDate)) errors.readyDate = "Sanani tanlang.";
    else if (v.readyDate < today) errors.readyDate = "O‘tgan sanani tanlab bo‘lmaydi.";
    if (!v.fromTime || !v.toTime) errors.toTime = "Vaqt oralig‘ini kiriting.";
    else if (v.toTime <= v.fromTime) errors.toTime = "Tugash vaqti boshlanishdan keyin bo‘lsin.";
    if (v.scale === "yes") {
      const g = parseKgToGrams(v.estimatedKg);
      if (g === null || g <= 0) errors.estimatedKg = "Taxminiy vaznni kg’da kiriting, masalan 45 yoki 45,5.";
    } else if (!v.volume) {
      errors.volume = "Taxminiy hajmni tanlang.";
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
          form.fail("Formada xato bor — qizil belgilangan maydonlarni tuzating.", errors);
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
          <p className="text-sm font-semibold text-muted">Olib ketish nuqtasi</p>
          <p className="font-bold">{points[0].name}</p>
          <p className="text-sm text-muted">{points[0].address}</p>
        </Card>
      ) : (
        <ChoiceGroup
          legend="Olib ketish nuqtasi"
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
          Karton qachon tayyor bo‘ladi? <span className="text-danger">*</span>
        </p>
        <QuickChips
          label="Sana"
          options={[
            { key: today, label: "Bugun" },
            { key: tomorrow, label: "Ertaga" },
          ]}
          isActive={(k) => v.readyDate === k}
          onPick={(k) => form.setValue("readyDate", k)}
        />
        <TextInput
          label="Sana"
          type="date"
          min={today}
          value={v.readyDate}
          onChange={(e) => form.setValue("readyDate", e.target.value)}
          error={fe.readyDate}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          Vaqt oralig‘i <span className="text-danger">*</span>
        </p>
        <QuickChips
          label="Tezkor vaqt oralig‘i"
          options={WINDOWS}
          isActive={(k) => `${v.fromTime}-${v.toTime}` === k}
          onPick={(k) => {
            const [from = "", to = ""] = k.split("-");
            form.patch({ fromTime: from, toTime: to });
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Boshlanishi" type="time" step={900} value={v.fromTime} onChange={(e) => form.setValue("fromTime", e.target.value)} error={fe.fromTime} />
          <TextInput label="Tugashi" type="time" step={900} value={v.toTime} onChange={(e) => form.setValue("toTime", e.target.value)} error={fe.toTime} />
        </div>
      </div>

      <ChoiceGroup
        legend="Kartonni tortib ko‘rdingizmi?"
        name="scale"
        columns={2}
        value={v.scale}
        onChange={(x) => form.setValue("scale", x)}
        options={[
          { value: "yes", label: "Tarozim bor", description: "Taxminiy kg yozaman" },
          { value: "no", label: "Tarozisiz", description: "Hajmini tanlayman" },
        ]}
      />

      {v.scale === "yes" ? (
        <KgInput
          label="Taxminiy vazn"
          required
          hint="Aniq vaznni yig‘uvchi o‘z tarozisida tortadi."
          value={v.estimatedKg}
          onValueChange={(x) => form.setValue("estimatedKg", x)}
          error={fe.estimatedKg}
        />
      ) : (
        <ChoiceGroup
          legend="Taxminiy hajm"
          name="volume"
          required
          value={v.volume}
          onChange={(x) => form.setValue("volume", x)}
          error={fe.volume}
          options={VOLUME_OPTIONS.map((o) => ({ value: o, label: VOLUME_LABEL[o] }))}
        />
      )}

      <PhotoInput
        kind="REQUEST_PHOTO"
        label="Karton rasmi"
        hint="Yig‘uvchi hajmni oldindan ko‘radi."
        value={v.photoId || null}
        onChange={(id) => form.setValue("photoId", id ?? "")}
        onUploadingChange={setUploading}
      />

      <Textarea
        label="Izoh"
        optional
        placeholder="Masalan: orqa eshikdan, qo‘riqchiga ayting"
        value={v.note}
        onChange={(e) => form.setValue("note", e.target.value)}
        error={fe.note}
      />

      <FormStatus form={form} only="result" success="Buyurtma yuborildi. Tafsilotlar ochilmoqda…" />

      <StickyActionBar>
        <Button type="submit" size="lg" block loading={form.pending} disabled={uploading}>
          {uploading ? "Rasm yuklanmoqda…" : "Yuborish"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import type { TripBuilderOptions } from "@/server/contract";
import { createTrip } from "@/server/actions/operator";
import { VOLUME_LABEL, uzText, pointTitle } from "@/domain/labels";
import { parseSom } from "@/domain/money";
import { formatKg, formatSom, formatWindow } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { Select, SomInput, TextInput, Textarea, sanitizeSom } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { Badge, LateBadge } from "@/components/ui/StatusBadge";
import { IconArrowDown, IconArrowUp, IconTruck, IconX } from "@/components/ui/icons";

type Values = {
  order: string; // vergul bilan ajratilgan requestId’lar — to‘xtash tartibi
  collectorId: string;
  buyerId: string;
  date: string;
  fromTime: string;
  toTime: string;
  shopPrice: string;
  buyerPrice: string;
  serviceFee: string;
  vehicle: string;
  note: string;
};

export function TripBuilder({
  options,
  defaults,
}: {
  options: TripBuilderOptions;
  defaults: { date: string; fromTime: string; toTime: string; today: string };
}) {
  const router = useRouter();
  const tariff = options.currentTariff;
  const initialOrder = options.selected.map((s) => s.id).join(",");
  const form = useActionForm<Values, { tripId: string }>({
    draftKey: `trip-builder:${initialOrder}`,
    initialValues: {
      order: initialOrder,
      collectorId: options.collectors.length === 1 ? (options.collectors[0]?.id ?? "") : "",
      buyerId: options.buyers.length === 1 ? (options.buyers[0]?.id ?? "") : "",
      date: defaults.date,
      fromTime: defaults.fromTime,
      toTime: defaults.toTime,
      shopPrice: tariff ? sanitizeSom(String(tariff.shopPricePerKg)) : "",
      buyerPrice: tariff ? sanitizeSom(String(tariff.buyerPricePerKg)) : "",
      serviceFee: tariff ? sanitizeSom(String(tariff.serviceFee)) : "0",
      vehicle: "",
      note: "",
    },
    resetOnSuccess: false,
    successMessage: "Reys tuzildi. Reys sahifasi ochilmoqda…",
    onSuccess: (data) => router.push(routes.operator.trip(data.tripId)),
  });
  const v = form.values;
  const fe = form.fieldErrors;

  const byId = new Map(options.selected.map((s) => [s.id, s]));
  const order = v.order.split(",").filter((id) => byId.has(id));
  const stops = order.map((id) => byId.get(id)!);
  const knownGrams = stops.reduce((s, x) => s + (x.estimatedGrams ?? 0), 0);
  const unknown = stops.filter((x) => x.estimatedGrams === null).length;
  const buyer = options.buyers.find((b) => b.id === v.buyerId) ?? null;
  const belowMin = buyer !== null && knownGrams < buyer.minBatchGrams;

  function setOrder(next: string[]) {
    form.setValue("order", next.join(","));
  }
  function move(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const copy = [...order];
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
    setOrder(copy);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (order.length === 0) e.order = "Kamida bitta bekat qoldiring.";
    if (!v.collectorId) e.collectorId = "Yig‘uvchini tanlang.";
    if (!v.buyerId) e.buyerId = "Xaridorni tanlang.";
    if (!v.date) e.date = "Sanani tanlang.";
    if (!v.fromTime || !v.toTime) e.toTime = "Vaqt oralig‘ini kiriting.";
    else if (v.toTime <= v.fromTime) e.toTime = "Tugash vaqti boshlanishdan keyin bo‘lsin.";
    if (parseSom(v.shopPrice) === null) e.shopPricePerKg = "Do‘kon narxini butun so‘mda kiriting.";
    if (parseSom(v.buyerPrice) === null) e.buyerPricePerKg = "Xaridor narxini butun so‘mda kiriting.";
    if (parseSom(v.serviceFee) === null) e.serviceFee = "Xizmat haqini kiriting (0 bo‘lishi mumkin).";
    return e;
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) {
          form.fail("Formada xato bor — belgilangan maydonlarni tuzating.", e);
          return;
        }
        void form.submit(({ clientKey, values }) =>
          createTrip({
            clientKey,
            requestIds: values.order.split(",").filter((id) => byId.has(id)),
            collectorId: values.collectorId,
            buyerId: values.buyerId,
            date: values.date,
            fromTime: values.fromTime,
            toTime: values.toTime,
            shopPricePerKg: parseSom(values.shopPrice) ?? 0,
            buyerPricePerKg: parseSom(values.buyerPrice) ?? 0,
            serviceFee: parseSom(values.serviceFee) ?? 0,
            vehicle: values.vehicle.trim() || undefined,
            note: values.note.trim() || undefined,
          }),
        );
      }}
    >
      <FormStatus form={form} only="draft" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section id="stops" title={`Bekatlar tartibi (${stops.length})`} description="Yig‘uvchi shu tartibda yuradi.">
          {fe.order || fe.requestIds ? <Notice tone="danger">{fe.order ?? fe.requestIds}</Notice> : null}
          <ol className="space-y-2">
            {stops.map((s, i) => (
              <li key={s.id}>
                <Card className="flex items-start gap-3 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kraft font-bold tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <p className="font-semibold">
                      №{s.number} · {pointTitle(s.point)}
                    </p>
                    <p className="text-muted">
                      {s.point.address} · {s.point.district}
                    </p>
                    <p className="tabular-nums">
                      {formatWindow(s.readyFrom, s.readyTo)} ·{" "}
                      {s.estimatedGrams !== null ? formatKg(s.estimatedGrams) : s.volume ? VOLUME_LABEL[s.volume] : "hajm yo‘q"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {s.status === "SKIPPED" ? (
                        <Badge tone="warning" icon="↺">
                          Qoldirilgan{s.lastSkipReason ? `: ${uzText(s.lastSkipReason)}` : ""}
                        </Badge>
                      ) : null}
                      {s.isLate ? <LateBadge /> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col sm:flex-row">
                    <Button size="sm" variant="ghost" className="px-2" aria-label={`№${s.number}ni yuqoriga`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <IconArrowUp size={18} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label={`№${s.number}ni pastga`}
                      disabled={i === stops.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <IconArrowDown size={18} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-danger"
                      aria-label={`№${s.number}ni reysdan olib tashlash`}
                      disabled={stops.length === 1}
                      onClick={() => setOrder(order.filter((id) => id !== s.id))}
                    >
                      <IconX size={18} />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
          <p className="text-sm tabular-nums">
            Taxminiy jami: <span className="font-bold">{formatKg(knownGrams)}</span>
            {unknown > 0 ? <span className="text-muted"> + {unknown} ta buyurtma hajm bo‘yicha (kg noma’lum)</span> : null}
          </p>
          <LinkButton href={routes.operator.queue} variant="ghost">
            Navbatga qaytib, tanlovni o‘zgartirish
          </LinkButton>
        </Section>

        <div className="space-y-6">
          <Section id="people" title="Yig‘uvchi va xaridor">
            {options.collectors.length === 0 ? (
              <Notice tone="warning" actions={<LinkButton href={routes.operator.directory} size="sm">Katalogga o‘tish</LinkButton>}>
                Faol yig‘uvchi yo‘q. Avval katalogda yig‘uvchi qo‘shing.
              </Notice>
            ) : null}
            <Select label="Yig‘uvchi" required value={v.collectorId} onChange={(e) => form.setValue("collectorId", e.target.value)} error={fe.collectorId}>
              <option value="">— tanlang —</option>
              {options.collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </Select>
            {options.buyers.length === 0 ? (
              <Notice tone="warning" actions={<LinkButton href={routes.operator.directory} size="sm">Katalogga o‘tish</LinkButton>}>
                Faol xaridor yo‘q. Avval katalogda xaridor qo‘shing.
              </Notice>
            ) : null}
            <Select label="Xaridor" required value={v.buyerId} onChange={(e) => form.setValue("buyerId", e.target.value)} error={fe.buyerId}>
              <option value="">— tanlang —</option>
              {options.buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {buyer ? (
              <Card tone="kraft" className="space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Sifat sharti:</span> {uzText(buyer.qualityTerms)}
                </p>
                <p className="tabular-nums">
                  <span className="font-semibold">Minimal partiya:</span> {formatKg(buyer.minBatchGrams)}
                </p>
                {buyer.contactName || buyer.phone ? (
                  <p>
                    <span className="font-semibold">Kontakt:</span> {[buyer.contactName, buyer.phone].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </Card>
            ) : null}
            {belowMin && buyer ? (
              <Notice tone="warning" title="Minimal partiyadan kam">
                Taxminiy jami {formatKg(knownGrams)} — xaridorning minimal partiyasi {formatKg(buyer.minBatchGrams)}. Yana bekat qo‘shing yoki xaridor bilan kelishing.
              </Notice>
            ) : null}
          </Section>

          <Section id="time" title="Vaqt">
            <TextInput label="Sana" type="date" required min={defaults.today} value={v.date} onChange={(e) => form.setValue("date", e.target.value)} error={fe.date} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Boshlanishi" type="time" required value={v.fromTime} onChange={(e) => form.setValue("fromTime", e.target.value)} error={fe.fromTime} />
              <TextInput label="Tugashi" type="time" required value={v.toTime} onChange={(e) => form.setValue("toTime", e.target.value)} error={fe.toTime} />
            </div>
          </Section>

          <Section
            id="prices"
            title="Kelishilgan narxlar"
            description={tariff ? "Joriy tarifdan to‘ldirildi. Reysda nusxa saqlanadi — keyingi tarif bu reysni o‘zgartirmaydi." : "Joriy tarif yo‘q — narxlarni qo‘lda kiriting."}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <SomInput label="Do‘konga, 1 kg" required value={v.shopPrice} onValueChange={(x) => form.setValue("shopPrice", x)} error={fe.shopPricePerKg} />
              <SomInput label="Xaridor, 1 kg" required value={v.buyerPrice} onValueChange={(x) => form.setValue("buyerPrice", x)} error={fe.buyerPricePerKg} />
              <SomInput label="Eco Point xizmat haqi" required hint="Reys uchun" value={v.serviceFee} onValueChange={(x) => form.setValue("serviceFee", x)} error={fe.serviceFee} />
            </div>
            {tariff ? (
              <p className="text-sm text-muted tabular-nums">
                Tarif: {formatSom(tariff.shopPricePerKg)}/kg · {formatSom(tariff.buyerPricePerKg)}/kg · xizmat {formatSom(tariff.serviceFee)}
              </p>
            ) : null}
          </Section>

          <Section id="extra" title="Qo‘shimcha">
            <TextInput label="Transport" optional placeholder="Masalan: Damas 01 A 123 BC" value={v.vehicle} onChange={(e) => form.setValue("vehicle", e.target.value)} error={fe.vehicle} />
            <Textarea label="Izoh" optional value={v.note} onChange={(e) => form.setValue("note", e.target.value)} error={fe.note} />
          </Section>
        </div>
      </div>

      <FormStatus form={form} only="result" />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" size="lg" loading={form.pending} icon={<IconTruck />} disabled={stops.length === 0}>
          Reysni saqlash ({stops.length} bekat)
        </Button>
      </div>
    </form>
  );
}

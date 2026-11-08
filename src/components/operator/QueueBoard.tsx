"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BuyerDTO, PersonOption, QueueItem, TariffDTO, VolumeSize } from "@/server/contract";
import { createTrip } from "@/server/actions/operator";
import { uzText } from "@/domain/labels";
import { formatKg, formatSom, formatWindow } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button, LinkButton, TextLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { Badge, LateBadge } from "@/components/ui/StatusBadge";
import {
  IconArrowDown,
  IconArrowUp,
  IconBag,
  IconChevronRight,
  IconClock,
  IconImage,
  IconMapPin,
  IconRoute,
  IconStore,
  IconTruck,
  IconX,
} from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { defaultTripWindow } from "./trip-defaults";

const VOLUME_SHORT: Record<VolumeSize, string> = { SMALL: "1–3 qop", MEDIUM: "4–8 qop", LARGE: "9+ qop" };

function volumeText(item: QueueItem) {
  if (item.estimatedGrams !== null) return formatKg(item.estimatedGrams);
  if (item.volume) return VOLUME_SHORT[item.volume];
  return "Hajm ko‘rsatilmagan";
}

const no = (n: number) => String(n).padStart(3, "0");

function Flags({ item }: { item: QueueItem }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {item.status === "SKIPPED" ? (
        <Badge tone="warning" icon="↺">
          Qoldirildi{item.lastSkipReason ? `: ${uzText(item.lastSkipReason)}` : ""}
        </Badge>
      ) : item.isLate ? null : (
        <Badge tone="info">Yangi</Badge>
      )}
      {item.isLate ? <LateBadge /> : null}
      {item.hasPhoto ? (
        <Badge tone="neutral">
          <span className="inline-flex items-center gap-1">
            <IconImage size={14} /> Rasm
          </span>
        </Badge>
      ) : null}
    </span>
  );
}

const checkbox = "size-6 shrink-0 cursor-pointer rounded accent-[#2ed47a]";

export interface QueueBoardProps {
  items: QueueItem[];
  collectors: PersonOption[];
  buyers: BuyerDTO[];
  tariff: TariffDTO | null;
  today: string;
  /** Jadval ostida (chap ustunda) ko‘rsatiladigan blok — masalan, hisoblagichlar. */
  footer?: ReactNode;
}

/** Navbat: tanlanadigan jadval (desktop) / kartalar (mobil) + «Yangi reys» paneli. */
export function QueueBoard({ items, collectors, buyers, tariff, today, footer }: QueueBoardProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const chosen = selected.map((id) => byId.get(id)).filter((x): x is QueueItem => Boolean(x));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function move(index: number, delta: -1 | 1) {
    setSelected((prev) => {
      const list = prev.filter((id) => byId.has(id));
      const j = index + delta;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      const a = copy[index]!;
      copy[index] = copy[j]!;
      copy[j] = a;
      return copy;
    });
  }
  const allSelected = items.length > 0 && items.every((i) => selected.includes(i.id));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        {/* Desktop jadval */}
        <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Olib ketish navbati — reysga qo‘shish uchun tanlang</caption>
            <thead className="bg-canvas text-sm font-bold uppercase tracking-wide text-ink">
              <tr>
                <th scope="col" className="w-14 p-0">
                  <label className="flex min-h-14 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : items.map((i) => i.id))}
                      aria-label="Hammasini tanlash"
                    />
                  </label>
                </th>
                <th scope="col" className="w-16 px-2 py-3">№</th>
                <th scope="col" className="px-2 py-3">Do‘kon / nuqta</th>
                <th scope="col" className="px-2 py-3">Tayyor vaqti</th>
                <th scope="col" className="px-2 py-3">Holat va izoh</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSel = selected.includes(item.id);
                const order = chosen.findIndex((c) => c.id === item.id);
                return (
                  <tr key={item.id} className={cx("border-t border-line align-top transition-colors", isSel ? "bg-mint-soft" : "hover:bg-canvas")}>
                    <td className="p-0">
                      <label className="flex min-h-16 cursor-pointer items-center justify-center pt-2">
                        <input
                          type="checkbox"
                          className={checkbox}
                          checked={isSel}
                          onChange={() => toggle(item.id)}
                          aria-label={`Buyurtma №${item.number} — ${item.point.shopName}ni tanlash`}
                        />
                      </label>
                    </td>
                    <td className="px-2 py-4 text-lg font-bold tabular-nums">
                      {no(item.number)}
                      {order >= 0 ? <span className="block text-xs font-semibold text-primary">{order + 1}-bekat</span> : null}
                    </td>
                    <td className="min-w-52 px-2 py-4">
                      <span className="flex items-center gap-2 text-lg font-bold">
                        <IconStore size={20} className="shrink-0 text-primary" />
                        {item.point.shopName}
                      </span>
                      <span className="mt-1 flex items-start gap-2 text-muted">
                        <IconMapPin size={18} className="mt-0.5 shrink-0" />
                        <span>
                          {item.point.name === item.point.shopName || item.point.name.includes(item.point.shopName)
                            ? item.point.address
                            : `${item.point.name} · ${item.point.address}`}
                        </span>
                      </span>
                      <span className="ml-7 mt-1.5 inline-block rounded-full bg-canvas px-2.5 py-0.5 text-sm font-semibold">{item.point.district}</span>
                    </td>
                    <td className="px-2 py-4 tabular-nums">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <IconClock size={18} className="shrink-0 text-muted" />
                        {formatWindow(item.readyFrom, item.readyTo)}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <IconBag size={18} className="shrink-0 text-muted" />
                        {volumeText(item)}
                      </span>
                    </td>
                    <td className="min-w-44 space-y-1.5 px-2 py-4">
                      <Flags item={item} />
                      {item.note ? <p className="text-sm text-muted">{uzText(item.note)}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobil kartalar */}
        <ul className="space-y-2 md:hidden">
          {items.map((item) => {
            const isSel = selected.includes(item.id);
            const order = chosen.findIndex((c) => c.id === item.id);
            return (
              <li key={item.id}>
                <label
                  className={cx(
                    "flex cursor-pointer gap-3 rounded-2xl border bg-surface p-3",
                    "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                    isSel ? "border-2 border-mint bg-mint-soft" : "border-line",
                  )}
                >
                  <input
                    type="checkbox"
                    className={cx(checkbox, "mt-1")}
                    checked={isSel}
                    onChange={() => toggle(item.id)}
                    aria-label={`Buyurtma №${item.number} — ${item.point.shopName}ni tanlash`}
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">
                        <span className="tabular-nums">{no(item.number)}</span> · {item.point.shopName}
                      </span>
                      {order >= 0 ? <span className="text-sm font-semibold text-primary">{order + 1}-bekat</span> : null}
                    </span>
                    <span className="block text-sm text-muted">
                      {item.point.address} · {item.point.district}
                    </span>
                    <span className="block text-sm tabular-nums">
                      {formatWindow(item.readyFrom, item.readyTo)} · {volumeText(item)}
                    </span>
                    <Flags item={item} />
                    {item.note ? <span className="block text-sm text-muted">{uzText(item.note)}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>

      <NewTripPanel
        chosen={chosen}
        collectors={collectors}
        buyers={buyers}
        tariff={tariff}
        today={today}
        onMove={move}
        onRemove={toggle}
        onClear={() => setSelected([])}
      />

      {/* Mobil: pastki yopishqoq tugma panelga olib boradi */}
      {chosen.length > 0 ? <div aria-hidden="true" className="h-16 md:hidden" /> : null}
      {chosen.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
          <LinkButton href="#new-trip" variant="mint" size="lg" block icon={<IconTruck />}>
            Yangi reys ({chosen.length})
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bekatlar tartibi sxemasi (haqiqiy xarita emas — xarita kaliti talab qilinmaydi)
// ---------------------------------------------------------------------------
function RouteSketch({ stops }: { stops: QueueItem[] }) {
  const W = 420;
  const H = 170;
  const n = stops.length;
  const pts = stops.map((_, i) => {
    const x = n === 1 ? W / 2 : 48 + (i * (W - 96)) / (n - 1);
    const y = n === 1 ? H / 2 : i % 2 === 0 ? 44 + ((i * 17) % 20) : 126 - ((i * 13) % 18);
    return { x, y };
  });
  const path = pts.length > 1 ? `M${pts.map((p) => `${p.x},${p.y}`).join(" L")}` : "";
  const label =
    n === 0 ? "Bekatlar tanlanmagan" : `Bekatlar tartibi: ${stops.map((s, i) => `${i + 1} — ${s.point.shopName}`).join(", ")}`;

  return (
    <figure className="overflow-hidden rounded-xl border border-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full bg-[#eef1ee]">
        {/* ko‘cha kvartallari */}
        {Array.from({ length: 7 }).map((_, c) =>
          Array.from({ length: 4 }).map((__, r) => (
            <rect
              key={`${c}-${r}`}
              x={8 + c * 60}
              y={6 + r * 41}
              width={50}
              height={33}
              rx={5}
              fill={(c * 3 + r) % 7 === 0 ? "#c9f2d9" : "#ffffff"}
              opacity={0.95}
            />
          )),
        )}
        {path ? <path d={path} fill="none" stroke="#2ed47a" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={16} fill="#2ed47a" stroke="#ffffff" strokeWidth={3} />
            <text x={p.x} y={p.y + 5.5} textAnchor="middle" fontSize={16} fontWeight={700} fill="#17392e">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="border-t border-line bg-surface px-3 py-1.5 text-xs text-muted">
        Tartib sxemasi — haqiqiy xarita emas
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// «Yangi reys» paneli: tartib, yig‘uvchi, xaridor → reys yaratish
// ---------------------------------------------------------------------------
function NewTripPanel({
  chosen,
  collectors,
  buyers,
  tariff,
  today,
  onMove,
  onRemove,
  onClear,
}: {
  chosen: QueueItem[];
  collectors: PersonOption[];
  buyers: BuyerDTO[];
  tariff: TariffDTO | null;
  today: string;
  onMove: (i: number, d: -1 | 1) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const activeBuyers = buyers.filter((b) => b.isActive);
  const form = useActionForm<{ collectorId: string; buyerId: string }, { tripId: string }>({
    initialValues: {
      collectorId: collectors.length === 1 ? (collectors[0]?.id ?? "") : "",
      buyerId: activeBuyers.length === 1 ? (activeBuyers[0]?.id ?? "") : "",
    },
    resetOnSuccess: false,
    flash: false,
    successMessage: "Reys yaratildi. Reys sahifasi ochilmoqda…",
    onSuccess: (data) => router.push(routes.operator.trip(data.tripId)),
  });
  const v = form.values;
  const fe = form.fieldErrors;

  const ids = chosen.map((c) => c.id);
  const knownGrams = chosen.reduce((s, c) => s + (c.estimatedGrams ?? 0), 0);
  const unknown = chosen.filter((c) => c.estimatedGrams === null).length;
  const buyer = activeBuyers.find((b) => b.id === v.buyerId) ?? null;
  const belowMin = buyer !== null && chosen.length > 0 && knownGrams < buyer.minBatchGrams;
  const win = defaultTripWindow(chosen, today);
  const winLabel = chosen.length
    ? formatWindow(new Date(`${win.date}T${win.fromTime}:00+05:00`), new Date(`${win.date}T${win.toTime}:00+05:00`))
    : null;

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (chosen.length === 0) e.order = "Navbatdan kamida bitta buyurtmani belgilang.";
    if (!v.collectorId) e.collectorId = "Yig‘uvchini tanlang.";
    if (!v.buyerId) e.buyerId = "Xaridorni tanlang.";
    if (!tariff) e.tariff = "Joriy tarif yo‘q. Katalogda tarif kiriting yoki narxlarni «Vaqt va narxlarni sozlash»da qo‘lda bering.";
    if (Object.keys(e).length) {
      form.fail(e.order ?? e.tariff ?? "Yig‘uvchi va xaridorni tanlang.", e);
      return;
    }
    void form.submit(({ clientKey, values }) =>
      createTrip({
        clientKey,
        requestIds: ids,
        collectorId: values.collectorId,
        buyerId: values.buyerId,
        date: win.date,
        fromTime: win.fromTime,
        toTime: win.toTime,
        shopPricePerKg: tariff!.shopPricePerKg,
        buyerPricePerKg: tariff!.buyerPricePerKg,
        serviceFee: tariff!.serviceFee,
      }),
    );
  }

  return (
    <aside id="new-trip" aria-labelledby="new-trip-title" className="min-w-0 scroll-mt-20">
      <form noValidate onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="new-trip-title" className="flex items-center gap-3 text-2xl font-bold">
          <IconTruck size={30} className="text-mint-hover" />
          Yangi reys
        </h2>

        <RouteSketch stops={chosen} />

        {chosen.length === 0 ? (
          <p className="text-muted">Navbatdan buyurtmalarni belgilang — ular shu yerda to‘xtash tartibida chiqadi.</p>
        ) : (
          <ol className="divide-y divide-line">
            {chosen.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint font-bold text-ink tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{c.point.shopName}</span>
                  <span className="block text-sm text-muted">{c.point.address}</span>
                </span>
                <span className="flex shrink-0">
                  <Button size="sm" variant="ghost" className="px-2 text-ink" aria-label={`${c.point.shopName}ni yuqoriga`} disabled={i === 0} onClick={() => onMove(i, -1)}>
                    <IconArrowUp size={18} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-ink"
                    aria-label={`${c.point.shopName}ni pastga`}
                    disabled={i === chosen.length - 1}
                    onClick={() => onMove(i, 1)}
                  >
                    <IconArrowDown size={18} />
                  </Button>
                  <Button size="sm" variant="ghost" className="px-2 text-danger" aria-label={`${c.point.shopName}ni olib tashlash`} onClick={() => onRemove(c.id)}>
                    <IconX size={18} />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="grid grid-cols-2 divide-x divide-line rounded-xl border border-line">
          <div className="flex items-center gap-3 p-3">
            <IconRoute size={26} className="shrink-0 text-mint-hover" />
            <span className="font-bold tabular-nums">{chosen.length} ta nuqta</span>
          </div>
          <div className="flex items-center gap-3 p-3">
            <IconBag size={26} className="shrink-0 text-muted" />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm text-muted">Taxminiy vazn</span>
              <span className="block text-lg font-bold tabular-nums">{formatKg(knownGrams)}</span>
              {unknown > 0 ? <span className="block text-xs text-muted">+ {unknown} ta hajm bo‘yicha</span> : null}
            </span>
          </div>
        </div>

        <Select label="Yig‘uvchi" value={v.collectorId} onChange={(e) => form.setValue("collectorId", e.target.value)} error={fe.collectorId}>
          <option value="">Yig‘uvchi tanlang</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
        </Select>

        <Select
          label="Xaridor"
          value={v.buyerId}
          onChange={(e) => form.setValue("buyerId", e.target.value)}
          error={fe.buyerId}
          hint={buyer ? `Minimal partiya: ${formatKg(buyer.minBatchGrams)}` : undefined}
        >
          <option value="">Xaridor tanlang</option>
          {activeBuyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>

        {buyer ? (
          <details className="rounded-xl bg-canvas px-3 text-sm">
            <summary className="inline-flex min-h-11 items-center font-semibold">Xaridorning sifat sharti</summary>
            <p className="pb-3">{uzText(buyer.qualityTerms)}</p>
          </details>
        ) : null}

        {belowMin ? (
          <Notice tone="warning">
            Taxminiy vazn ({formatKg(knownGrams)}) xaridorning minimal partiyasidan ({formatKg(buyer!.minBatchGrams)}) kam. Reys yaratish mumkin, lekin xaridor bilan kelishing.
          </Notice>
        ) : null}

        {chosen.length > 0 ? (
          <p className="text-sm text-muted tabular-nums">
            Vaqt: <span className="font-semibold text-ink">{winLabel}</span>
            {tariff ? (
              <>
                {" "}
                · Narx: <span className="font-semibold text-ink">{formatSom(tariff.shopPricePerKg)}</span> /{" "}
                <span className="font-semibold text-ink">{formatSom(tariff.buyerPricePerKg)}</span> kg uchun (do‘kon / xaridor)
              </>
            ) : null}
          </p>
        ) : null}

        <FormStatus form={form} only="result" />

        <Button type="submit" variant="mint" size="xl" block loading={form.pending} loadingText="Yaratilmoqda…" icon={<IconTruck size={26} />} disabled={chosen.length === 0}>
          Reys yaratish
        </Button>

        {chosen.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextLink href={routes.operator.newTrip(ids)}>
              Vaqt va narxlarni sozlash <IconChevronRight size={16} />
            </TextLink>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Tanlovni tozalash
            </Button>
          </div>
        ) : null}
      </form>
    </aside>
  );
}

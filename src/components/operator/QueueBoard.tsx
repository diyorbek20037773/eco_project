"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BuyerDTO, PersonOption, QueueItem, TariffDTO } from "@/server/contract";
import { createTrip } from "@/server/actions/operator";
import { uzText } from "@/domain/labels";
import { fmt, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/dictionaries";
import { formatKgL, formatSomL, formatWindowL } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button, LinkButton, TextLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { Badge } from "@/components/ui/StatusBadge";
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

type Tq = Dict["queue"];
type Tp = Dict["panel"];

function volumeText(item: QueueItem, tq: Tq, locale: Locale) {
  if (item.estimatedGrams !== null) return formatKgL(item.estimatedGrams, locale);
  if (item.volume) return tq[`vol${item.volume}`];
  return tq.noVolume;
}

const no = (n: number) => String(n).padStart(3, "0");

function LateFlag({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-sun-line bg-sun px-2.5 py-0.5 text-sm font-semibold leading-6 text-ink">
      <span aria-hidden="true">◷</span>
      <span className="min-w-0 [overflow-wrap:normal]">{text}</span>
    </span>
  );
}

function Flags({ item, tq }: { item: QueueItem; tq: Tq }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {item.status === "SKIPPED" ? (
        <Badge tone="warning" icon="↺">
          {tq.skipped}
          {item.lastSkipReason ? `: ${uzText(item.lastSkipReason)}` : ""}
        </Badge>
      ) : item.isLate ? null : (
        <Badge tone="info">{tq.statusNew}</Badge>
      )}
      {item.isLate ? <LateFlag text={tq.late} /> : null}
      {item.hasPhoto ? (
        <Badge tone="neutral">
          <span className="inline-flex items-center gap-1">
            <IconImage size={14} /> {tq.photo}
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
  locale: Locale;
  tq: Tq;
  tp: Tp;
  /** Jadval ostida (chap ustunda) ko‘rsatiladigan blok — masalan, hisoblagichlar. */
  footer?: ReactNode;
}

/** Navbat: tanlanadigan jadval (desktop) / kartalar (mobil) + «Yangi reys» paneli. */
export function QueueBoard({ items, collectors, buyers, tariff, today, locale, tq, tp, footer }: QueueBoardProps) {
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
  const rowLabel = (item: QueueItem) => fmt(tq.selectRow, { n: item.number, shop: item.point.shopName });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        {/* Desktop jadval */}
        <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{tq.caption}</caption>
            <thead className="bg-canvas text-sm font-bold uppercase tracking-wide text-ink">
              <tr>
                <th scope="col" className="w-14 p-0">
                  <label className="flex min-h-14 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : items.map((i) => i.id))}
                      aria-label={tq.selectAll}
                    />
                  </label>
                </th>
                <th scope="col" className="w-16 px-2 py-3">
                  {tq.colNo}
                </th>
                <th scope="col" className="px-2 py-3">
                  {tq.colShop}
                </th>
                <th scope="col" className="px-2 py-3">
                  {tq.colTime}
                </th>
                <th scope="col" className="px-2 py-3">
                  {tq.colStatus}
                </th>
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
                        <input type="checkbox" className={checkbox} checked={isSel} onChange={() => toggle(item.id)} aria-label={rowLabel(item)} />
                      </label>
                    </td>
                    <td className="px-2 py-4 text-lg font-bold tabular-nums">
                      {no(item.number)}
                      {order >= 0 ? <span className="block text-xs font-semibold text-primary">{fmt(tq.stopN, { n: order + 1 })}</span> : null}
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
                        {formatWindowL(item.readyFrom, item.readyTo, locale)}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <IconBag size={18} className="shrink-0 text-muted" />
                        {volumeText(item, tq, locale)}
                      </span>
                    </td>
                    <td className="min-w-44 space-y-1.5 px-2 py-4">
                      <Flags item={item} tq={tq} />
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
                  <input type="checkbox" className={cx(checkbox, "mt-1")} checked={isSel} onChange={() => toggle(item.id)} aria-label={rowLabel(item)} />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">
                        <span className="tabular-nums">{no(item.number)}</span> · {item.point.shopName}
                      </span>
                      {order >= 0 ? <span className="text-sm font-semibold text-primary">{fmt(tq.stopN, { n: order + 1 })}</span> : null}
                    </span>
                    <span className="block text-sm text-muted">
                      {item.point.address} · {item.point.district}
                    </span>
                    <span className="block text-sm tabular-nums">
                      {formatWindowL(item.readyFrom, item.readyTo, locale)} · {volumeText(item, tq, locale)}
                    </span>
                    <Flags item={item} tq={tq} />
                    {item.note ? <span className="block text-sm text-muted">{uzText(item.note)}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {footer ? <div className="mt-6 space-y-6">{footer}</div> : null}
      </div>

      <NewTripPanel
        chosen={chosen}
        collectors={collectors}
        buyers={buyers}
        tariff={tariff}
        today={today}
        locale={locale}
        tp={tp}
        onMove={move}
        onRemove={toggle}
        onClear={() => setSelected([])}
      />

      {/* Mobil: pastki yopishqoq tugma panelga olib boradi */}
      {chosen.length > 0 ? <div aria-hidden="true" className="h-16 md:hidden" /> : null}
      {chosen.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
          <LinkButton href="#new-trip" variant="mint" size="lg" block icon={<IconTruck />}>
            {fmt(tq.mobileNewTrip, { n: chosen.length })}
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bekatlar tartibi sxemasi (haqiqiy xarita emas — xarita kaliti talab qilinmaydi)
// ---------------------------------------------------------------------------
function RouteSketch({ stops, tp }: { stops: QueueItem[]; tp: Tp }) {
  const W = 420;
  const H = 170;
  const n = stops.length;
  const pts = stops.map((_, i) => {
    const x = n === 1 ? W / 2 : 48 + (i * (W - 96)) / (n - 1);
    const y = n === 1 ? H / 2 : i % 2 === 0 ? 44 + ((i * 17) % 20) : 126 - ((i * 13) % 18);
    return { x, y };
  });
  const path = pts.length > 1 ? `M${pts.map((p) => `${p.x},${p.y}`).join(" L")}` : "";
  const label = n === 0 ? tp.sketchNone : `${tp.sketchLabel}: ${stops.map((s, i) => `${i + 1} — ${s.point.shopName}`).join(", ")}`;

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
      <figcaption className="border-t border-line bg-surface px-3 py-1.5 text-xs text-muted">{tp.sketchCaption}</figcaption>
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
  locale,
  tp,
  onMove,
  onRemove,
  onClear,
}: {
  chosen: QueueItem[];
  collectors: PersonOption[];
  buyers: BuyerDTO[];
  tariff: TariffDTO | null;
  today: string;
  locale: Locale;
  tp: Tp;
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
    successMessage: tp.created,
    onSuccess: (data) => router.push(routes.operator.trip(data.tripId)),
  });
  const v = form.values;
  const fe = form.fieldErrors;
  const kg = (g: number) => formatKgL(g, locale);

  const ids = chosen.map((c) => c.id);
  const knownGrams = chosen.reduce((s, c) => s + (c.estimatedGrams ?? 0), 0);
  const unknown = chosen.filter((c) => c.estimatedGrams === null).length;
  const buyer = activeBuyers.find((b) => b.id === v.buyerId) ?? null;
  const belowMin = buyer !== null && chosen.length > 0 && knownGrams < buyer.minBatchGrams;
  const win = defaultTripWindow(chosen, today);
  const winLabel = chosen.length
    ? formatWindowL(new Date(`${win.date}T${win.fromTime}:00+05:00`), new Date(`${win.date}T${win.toTime}:00+05:00`), locale)
    : null;

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (chosen.length === 0) e.order = tp.errOrder;
    if (!v.collectorId) e.collectorId = tp.errCollector;
    if (!v.buyerId) e.buyerId = tp.errBuyer;
    if (!tariff) e.tariff = tp.errTariff;
    if (Object.keys(e).length) {
      form.fail(e.order ?? e.tariff ?? tp.errGeneric, e);
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
          {tp.title}
        </h2>

        <RouteSketch stops={chosen} tp={tp} />

        {chosen.length === 0 ? (
          <p className="text-muted">{tp.emptyHint}</p>
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
                  <Button size="sm" variant="ghost" className="px-2 text-ink" aria-label={fmt(tp.up, { name: c.point.shopName })} disabled={i === 0} onClick={() => onMove(i, -1)}>
                    <IconArrowUp size={18} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-ink"
                    aria-label={fmt(tp.down, { name: c.point.shopName })}
                    disabled={i === chosen.length - 1}
                    onClick={() => onMove(i, 1)}
                  >
                    <IconArrowDown size={18} />
                  </Button>
                  <Button size="sm" variant="ghost" className="px-2 text-danger" aria-label={fmt(tp.remove, { name: c.point.shopName })} onClick={() => onRemove(c.id)}>
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
            <span className="font-bold tabular-nums">{fmt(tp.points, { n: chosen.length })}</span>
          </div>
          <div className="flex items-center gap-3 p-3">
            <IconBag size={26} className="shrink-0 text-muted" />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm text-muted">{tp.estWeight}</span>
              <span className="block text-lg font-bold tabular-nums">{kg(knownGrams)}</span>
              {unknown > 0 ? <span className="block text-xs text-muted">{fmt(tp.byVolume, { n: unknown })}</span> : null}
            </span>
          </div>
        </div>

        <Select label={tp.collector} value={v.collectorId} onChange={(e) => form.setValue("collectorId", e.target.value)} error={fe.collectorId}>
          <option value="">{tp.chooseCollector}</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
        </Select>

        <Select
          label={tp.buyer}
          value={v.buyerId}
          onChange={(e) => form.setValue("buyerId", e.target.value)}
          error={fe.buyerId}
          hint={buyer ? fmt(tp.minBatch, { kg: kg(buyer.minBatchGrams) }) : undefined}
        >
          <option value="">{tp.chooseBuyer}</option>
          {activeBuyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>

        {buyer ? (
          <details className="rounded-xl bg-canvas px-3 text-sm">
            <summary className="inline-flex min-h-11 items-center font-semibold">{tp.qualityTerms}</summary>
            <p className="pb-3">{uzText(buyer.qualityTerms)}</p>
          </details>
        ) : null}

        {belowMin ? <Notice tone="warning">{fmt(tp.belowMin, { kg: kg(knownGrams), min: kg(buyer!.minBatchGrams) })}</Notice> : null}

        {chosen.length > 0 ? (
          <p className="text-sm text-muted tabular-nums">
            {tp.timeLabel}: <span className="font-semibold text-ink">{winLabel}</span>
            {tariff ? (
              <>
                {" "}
                · {tp.priceLabel}: <span className="font-semibold text-ink">{formatSomL(tariff.shopPricePerKg, locale)}</span> /{" "}
                <span className="font-semibold text-ink">{formatSomL(tariff.buyerPricePerKg, locale)}</span> {tp.priceSuffix}
              </>
            ) : null}
          </p>
        ) : null}

        <FormStatus form={form} only="result" />

        <Button type="submit" variant="mint" size="xl" block loading={form.pending} loadingText={tp.creating} icon={<IconTruck size={26} />} disabled={chosen.length === 0}>
          {tp.create}
        </Button>

        {chosen.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextLink href={routes.operator.newTrip(ids)}>
              {tp.customize} <IconChevronRight size={16} />
            </TextLink>
            <Button variant="ghost" size="sm" onClick={onClear}>
              {tp.clear}
            </Button>
          </div>
        ) : null}
      </form>
    </aside>
  );
}

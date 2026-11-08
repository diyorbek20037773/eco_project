"use client";

import { useState } from "react";
import type { QueueItem } from "@/server/contract";
import { VOLUME_LABEL, uzText } from "@/domain/labels";
import { formatKg, formatWindow } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, LateBadge } from "@/components/ui/StatusBadge";
import { IconArrowDown, IconArrowUp, IconImage, IconTruck, IconX } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

function volumeText(item: QueueItem) {
  if (item.estimatedGrams !== null) return formatKg(item.estimatedGrams);
  if (item.volume) return VOLUME_LABEL[item.volume];
  return "—";
}

function Flags({ item }: { item: QueueItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {item.status === "SKIPPED" ? (
        <Badge tone="warning" icon="↺">
          Qoldirildi{item.lastSkipReason ? `: ${uzText(item.lastSkipReason)}` : ""}
        </Badge>
      ) : (
        <Badge tone="info">Yangi</Badge>
      )}
      {item.isLate ? <LateBadge /> : null}
      {item.hasPhoto ? (
        <Badge tone="neutral">
          <span className="inline-flex items-center gap-1">
            <IconImage size={14} /> Rasm bor
          </span>
        </Badge>
      ) : null}
    </span>
  );
}

/** Navbat: tanlanadigan jadval (desktop) / kartalar (mobil) + tanlangan bekatlarning tartibli ro‘yxati. */
export function QueueBoard({ items }: { items: QueueItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const chosen = selected.map((id) => byId.get(id)).filter((x): x is QueueItem => Boolean(x));
  const chosenIds = chosen.map((c) => c.id);
  const knownGrams = chosen.reduce((s, c) => s + (c.estimatedGrams ?? 0), 0);
  const unknownCount = chosen.filter((c) => c.estimatedGrams === null).length;

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        {/* Desktop jadval */}
        <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Olib ketish navbati — reysga qo‘shish uchun tanlang</caption>
            <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="w-12 p-0">
                  <label className="flex min-h-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-[#176947]"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : items.map((i) => i.id))}
                      aria-label="Hammasini tanlash"
                    />
                  </label>
                </th>
                <th scope="col" className="w-14 px-2 py-2">№</th>
                <th scope="col" className="px-2 py-2">Do‘kon / nuqta / hudud</th>
                <th scope="col" className="px-2 py-2">Tayyor vaqti va hajm</th>
                <th scope="col" className="px-2 py-2">Holat va izoh</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSel = selected.includes(item.id);
                const order = chosenIds.indexOf(item.id);
                return (
                  <tr key={item.id} className={cx("border-t border-line align-top", isSel && "bg-primary-soft")}>
                    <td className="p-0">
                      <label className="flex min-h-14 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          className="size-5 accent-[#176947]"
                          checked={isSel}
                          onChange={() => toggle(item.id)}
                          aria-label={`Buyurtma №${item.number} — ${item.point.shopName}ni tanlash`}
                        />
                      </label>
                    </td>
                    <td className="px-2 py-3 font-bold tabular-nums">
                      {item.number}
                      {order >= 0 ? <span className="block text-xs font-semibold text-primary">{order + 1}-bekat</span> : null}
                    </td>
                    <td className="min-w-48 px-2 py-3">
                      <span className="block font-semibold">{item.point.shopName}</span>
                      <span className="block text-muted">
                        {item.point.name === item.point.shopName || item.point.name.includes(item.point.shopName) ? item.point.address : `${item.point.name} · ${item.point.address}`}
                      </span>
                      <span className="mt-0.5 inline-block rounded-full bg-kraft px-2 text-xs font-semibold">{item.point.district}</span>
                    </td>
                    <td className="px-2 py-3 tabular-nums">
                      <span className="block whitespace-nowrap">{formatWindow(item.readyFrom, item.readyTo)}</span>
                      <span className="block text-muted">{volumeText(item)}</span>
                    </td>
                    <td className="min-w-44 space-y-1 px-2 py-3">
                      <Flags item={item} />
                      {item.note ? <p className="text-muted">{uzText(item.note)}</p> : null}
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
            const order = chosenIds.indexOf(item.id);
            return (
              <li key={item.id}>
                <label
                  className={cx(
                    "flex cursor-pointer gap-3 rounded-card border bg-surface p-3",
                    "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                    isSel ? "border-2 border-primary bg-primary-soft" : "border-line",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-6 shrink-0 accent-[#176947]"
                    checked={isSel}
                    onChange={() => toggle(item.id)}
                    aria-label={`Buyurtma №${item.number} — ${item.point.shopName}ni tanlash`}
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">
                        №{item.number} · {item.point.shopName}
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
      </div>

      {/* Tanlangan bekatlar */}
      <aside aria-labelledby="selected-title" className="min-w-0">
        <Card className="space-y-3 xl:sticky xl:top-6">
          <h2 id="selected-title" className="text-lg font-bold">
            Tanlangan bekatlar <span className="tabular-nums">({chosen.length})</span>
          </h2>
          {chosen.length === 0 ? (
            <p className="text-muted">Reys tuzish uchun navbatdan buyurtmalarni belgilang. Tartibni shu yerda o‘zgartirasiz.</p>
          ) : (
            <>
              <ol className="space-y-2">
                {chosen.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line bg-canvas p-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kraft font-bold tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold">
                        №{c.number} · {c.point.shopName}
                      </span>
                      <span className="block text-muted">{c.point.district}</span>
                    </span>
                    <Button size="sm" variant="ghost" className="px-2" aria-label={`№${c.number}ni yuqoriga`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <IconArrowUp size={18} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label={`№${c.number}ni pastga`}
                      disabled={i === chosen.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <IconArrowDown size={18} />
                    </Button>
                    <Button size="sm" variant="ghost" className="px-2 text-danger" aria-label={`№${c.number}ni olib tashlash`} onClick={() => toggle(c.id)}>
                      <IconX size={18} />
                    </Button>
                  </li>
                ))}
              </ol>
              <p className="text-sm tabular-nums">
                Taxminiy jami: <span className="font-bold">{formatKg(knownGrams)}</span>
                {unknownCount > 0 ? <span className="text-muted"> + {unknownCount} ta hajm bo‘yicha</span> : null}
              </p>
              <LinkButton href={routes.operator.newTrip(chosenIds)} size="lg" block icon={<IconTruck />} className="hidden md:inline-flex">
                Reys tuzish ({chosen.length})
              </LinkButton>
              <Button variant="ghost" block onClick={() => setSelected([])}>
                Tanlovni tozalash
              </Button>
            </>
          )}
        </Card>
      </aside>

      {/* Mobil: pastki yopishqoq tugma (navigatsiya ustida) */}
      {chosen.length > 0 ? <div aria-hidden="true" className="h-16 md:hidden" /> : null}
      {chosen.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-canvas/95 px-4 py-2 backdrop-blur md:hidden">
          <LinkButton href={routes.operator.newTrip(chosenIds)} size="lg" block icon={<IconTruck />}>
            Reys tuzish ({chosen.length})
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

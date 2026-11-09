"use client";

import Link from "next/link";
import type { StopDTO } from "@/server/contract";
import { uzText, pointTitle } from "@/domain/labels";
import { formatKgL, formatTime } from "@/lib/format";
import { fmt } from "@/i18n/config";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { routes } from "@/lib/routes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronRight } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

/** Reys bekatlari tartibli ro‘yxati (yig‘uvchi). */
export function StopList({ stops, currentId }: { stops: StopDTO[]; currentId?: string | null }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).stopList;
  const visible = [...stops].filter((s) => s.status !== "REMOVED").sort((a, b) => a.sequence - b.sequence);
  return (
    <ol className="space-y-2">
      {visible.map((s) => (
        <li key={s.id}>
          <Link
            href={routes.collector.stop(s.id)}
            aria-current={s.id === currentId ? "step" : undefined}
            className={cx(
              "flex min-h-14 items-center gap-3 rounded-card border bg-surface p-3 hover:border-primary",
              s.id === currentId ? "border-2 border-primary" : "border-line",
            )}
          >
            <span
              className={cx(
                "flex size-9 shrink-0 items-center justify-center rounded-full font-bold tabular-nums",
                s.status === "COLLECTED" ? "bg-primary text-white" : s.status === "SKIPPED" ? "bg-amber-soft text-amber" : "bg-kraft text-ink",
              )}
              aria-hidden="true"
            >
              {s.status === "COLLECTED" ? "✓" : s.sequence}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                <span className="sr-only">{fmt(t.srStop, { n: s.sequence })}</span>
                {pointTitle(s.point)}
              </span>
              <span className="block text-sm text-muted">{s.point.address}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge kind="stop" value={s.status} />
                {s.weighing ? <span className="font-semibold tabular-nums">{formatKgL(s.weighing.netGrams, locale)}</span> : null}
                {s.status === "PENDING" ? (
                  <span className="tabular-nums text-muted">
                    {formatTime(s.request.readyFrom)}–{formatTime(s.request.readyTo)}
                  </span>
                ) : null}
                {s.status === "SKIPPED" && s.skipReason ? <span className="text-amber">{uzText(s.skipReason)}</span> : null}
              </span>
            </span>
            <IconChevronRight className="shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

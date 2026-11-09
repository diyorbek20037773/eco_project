"use client";

import Link from "next/link";
import type { ShopRequestSummary } from "@/server/contract";
import { uzText } from "@/domain/labels";
import { formatKgL, formatWindowL } from "@/lib/format";
import { fmt } from "@/i18n/config";
import { labelsFor } from "@/i18n/labels";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { routes } from "@/lib/routes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronRight } from "@/components/ui/icons";

export function RequestCard({ r }: { r: ShopRequestSummary }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT);
  return (
    <Link
      href={routes.shop.request(r.id)}
      className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-4 hover:border-primary"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{fmt(t.c.orderNo, { n: r.number })}</span>
          <StatusBadge kind="request" value={r.status} />
        </div>
        <p className="text-sm text-muted">
          {r.point.name} · {r.trip ? formatWindowL(r.trip.windowStart, r.trip.windowEnd, locale) : formatWindowL(r.readyFrom, r.readyTo, locale)}
        </p>
        <p className="text-sm tabular-nums">
          {r.netGrams !== null
            ? fmt(t.card.net, { kg: formatKgL(r.netGrams, locale) })
            : r.estimatedGrams !== null
              ? fmt(t.c.approx, { kg: formatKgL(r.estimatedGrams, locale) })
              : r.volume
                ? labelsFor(locale).volume[r.volume]
                : t.card.noVolume}
        </p>
        {r.stop?.status === "SKIPPED" && r.stop.skipReason ? (
          <p className="text-sm font-semibold text-amber">{fmt(t.card.skipped, { reason: uzText(r.stop.skipReason) })}</p>
        ) : null}
      </div>
      <IconChevronRight className="shrink-0 text-muted" />
    </Link>
  );
}

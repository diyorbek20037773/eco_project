import Link from "next/link";
import type { ShopRequestSummary } from "@/server/contract";
import { VOLUME_LABEL, uzText } from "@/domain/labels";
import { formatKg, formatWindow } from "@/lib/format";
import { routes } from "@/lib/routes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronRight } from "@/components/ui/icons";

export function RequestCard({ r }: { r: ShopRequestSummary }) {
  return (
    <Link
      href={routes.shop.request(r.id)}
      className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-4 hover:border-primary"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">Buyurtma №{r.number}</span>
          <StatusBadge kind="request" value={r.status} />
        </div>
        <p className="text-sm text-muted">
          {r.point.name} · {r.trip ? formatWindow(r.trip.windowStart, r.trip.windowEnd) : formatWindow(r.readyFrom, r.readyTo)}
        </p>
        <p className="text-sm tabular-nums">
          {r.netGrams !== null
            ? `Sof vazn: ${formatKg(r.netGrams)}`
            : r.estimatedGrams !== null
              ? `Taxminan ${formatKg(r.estimatedGrams)}`
              : r.volume
                ? VOLUME_LABEL[r.volume]
                : "Hajm ko‘rsatilmagan"}
        </p>
        {r.stop?.status === "SKIPPED" && r.stop.skipReason ? (
          <p className="text-sm font-semibold text-amber">Qoldirildi: {uzText(r.stop.skipReason)}</p>
        ) : null}
      </div>
      <IconChevronRight className="shrink-0 text-muted" />
    </Link>
  );
}

import Link from "next/link";
import type { AuditDTO } from "@/server/contract";
import { uzText } from "@/domain/labels";
import { fmt, type Locale } from "@/i18n/config";
import { OPERATOR_DICT } from "@/i18n/operator";
import { routes } from "@/lib/routes";
import { formatDateTimeL } from "./datetime";

function json(v: unknown): string {
  if (v === null || v === undefined) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Audit hodisalari: kim, qachon, nima; tuzatishda avvalgi va yangi qiymat, sabab. */
export function AuditList({
  items,
  showTrip = false,
  tripIds,
  locale,
}: {
  items: AuditDTO[];
  showTrip?: boolean;
  tripIds?: Map<number, string>;
  locale: Locale;
}) {
  const d = OPERATOR_DICT[locale];
  const t = d.audit;
  if (items.length === 0) return <p className="text-muted">{t.empty}</p>;
  return (
    <ol className="space-y-2">
      {items.map((a) => {
        const hasDiff = a.before !== null && a.before !== undefined;
        const tripId = a.tripNumber !== null ? tripIds?.get(a.tripNumber) : undefined;
        return (
          <li key={a.id} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 font-semibold">
                <span>{t.action[a.action] ?? a.action}</span>
                <span className="text-muted"> · {t.entity[a.entityType] ?? a.entityType}</span>
                {showTrip && a.tripNumber !== null ? (
                  tripId ? (
                    <Link href={routes.operator.trip(tripId)} className="ml-1 text-primary underline underline-offset-4">
                      {fmt(d.common.tripNo, { n: a.tripNumber })}
                    </Link>
                  ) : (
                    <span className="text-muted"> · {fmt(d.common.tripNo, { n: a.tripNumber })}</span>
                  )
                ) : null}
              </p>
              <p className="text-sm text-muted tabular-nums">
                {formatDateTimeL(a.at, locale)} · {a.actorName ?? t.system}
              </p>
            </div>
            {a.reason ? (
              <p className="mt-1 text-sm">
                <span className="font-semibold">{t.reason}</span> {uzText(a.reason)}
              </p>
            ) : null}
            {hasDiff || (a.after !== null && a.after !== undefined) ? (
              <details className="mt-1">
                <summary className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                  {hasDiff ? t.diff : t.value}
                </summary>
                <div className="grid gap-2 sm:grid-cols-2">
                  {hasDiff ? (
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">{t.before}</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-2 text-xs">{json(a.before)}</pre>
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted">{t.after}</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-2 text-xs">{json(a.after)}</pre>
                  </div>
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

"use client";

// Mijoz komponenti: tilni o‘zi oladi (operator reys sahifasida ham shu ko‘rinish ishlatiladi).
import type { DisputeDTO, StopDTO, WeighingDTO } from "@/server/contract";
import { uzText } from "@/domain/labels";
import { formatKgL } from "@/lib/format";
import { fmt } from "@/i18n/config";
import { formatDateTimeL } from "@/i18n/common";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { Card, KeyValues } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";
import { Thumbs } from "@/components/ui/Thumbs";

export function WeighingSummary({ weighing, effectiveNetGrams }: { weighing: WeighingDTO; effectiveNetGrams?: number | null }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).weighing;
  const changed = effectiveNetGrams != null && effectiveNetGrams !== weighing.netGrams;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-line bg-surface p-2">
          <dt className="text-xs text-muted">{t.gross}</dt>
          <dd className="font-semibold tabular-nums">{formatKgL(weighing.grossGrams, locale)}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-2">
          <dt className="text-xs text-muted">{t.tare}</dt>
          <dd className="font-semibold tabular-nums">{formatKgL(weighing.tareGrams, locale)}</dd>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary-soft p-2">
          <dt className="text-xs text-muted">{t.net}</dt>
          <dd className="font-bold tabular-nums">{formatKgL(weighing.netGrams, locale)}</dd>
        </div>
      </dl>
      {changed ? (
        <p className="text-sm font-semibold">
          {t.effective} <span className="tabular-nums">{formatKgL(effectiveNetGrams, locale)}</span>
        </p>
      ) : null}
      <p className="text-sm text-muted">
        {fmt(t.recordedBy, { name: weighing.recordedByName, time: formatDateTimeL(weighing.recordedAt, locale) })}
      </p>
      <Thumbs items={weighing.photos} label={t.photos} />
    </div>
  );
}

export function ConfirmationLine({ confirmation }: { confirmation: StopDTO["confirmation"] }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).weighing;
  if (!confirmation) {
    return (
      <Badge tone="warning" icon="◷">
        {t.awaitingShop}
      </Badge>
    );
  }
  return confirmation.status === "CONFIRMED" ? (
    <p className="text-sm">
      <Badge tone="success" icon="✓">
        {t.shopConfirmed}
      </Badge>{" "}
      <span className="text-muted">
        {confirmation.byName} · {formatDateTimeL(confirmation.at, locale)}
      </span>
    </p>
  ) : (
    <p className="text-sm">
      <Badge tone="danger" icon="⚠">
        {t.shopDisputed}
      </Badge>{" "}
      <span className="text-muted">
        {confirmation.byName} · {formatDateTimeL(confirmation.at, locale)}
        {confirmation.reason ? ` — ${uzText(confirmation.reason)}` : ""}
      </span>
    </p>
  );
}

/** Bahs tarixi (faqat o‘qish uchun). */
export function DisputeSummary({ dispute }: { dispute: DisputeDTO }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).weighing;
  return (
    <Card tone={dispute.status === "RESOLVED" ? "surface" : "danger"} className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="dispute" value={dispute.status} />
        <span className="text-sm text-muted">
          {dispute.openedByName} · {formatDateTimeL(dispute.createdAt, locale)}
        </span>
      </div>
      <KeyValues
        rows={[
          { label: t.reason, value: <span className="font-normal">{uzText(dispute.reason)}</span> },
          ...(dispute.claimedNetGrams !== null ? [{ label: t.claimed, value: formatKgL(dispute.claimedNetGrams, locale) }] : []),
          ...(dispute.decisionText
            ? [{ label: `${t.decision}${dispute.decidedByName ? ` (${dispute.decidedByName})` : ""}`, value: <span className="font-normal">{uzText(dispute.decisionText)}</span> }]
            : []),
          ...(dispute.decidedNetGrams !== null ? [{ label: t.final, value: formatKgL(dispute.decidedNetGrams, locale), strong: true }] : []),
          ...(dispute.status !== "OPEN" || dispute.decisionText
            ? [
                { label: t.shopAck, value: dispute.shopAckAt ? `✓ ${formatDateTimeL(dispute.shopAckAt, locale)}` : t.pending },
                { label: t.collectorAck, value: dispute.collectorAckAt ? `✓ ${formatDateTimeL(dispute.collectorAckAt, locale)}` : t.pending },
              ]
            : []),
          ...(dispute.lastRejectComment ? [{ label: t.lastReject, value: <span className="font-normal">{uzText(dispute.lastRejectComment)}</span> }] : []),
        ]}
      />
    </Card>
  );
}

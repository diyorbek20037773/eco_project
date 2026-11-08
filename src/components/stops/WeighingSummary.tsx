import type { DisputeDTO, StopDTO, WeighingDTO } from "@/server/contract";
import { uzText } from "@/domain/labels";
import { formatDateTime, formatKg } from "@/lib/format";
import { Card, KeyValues } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";
import { Thumbs } from "@/components/ui/Thumbs";

export function WeighingSummary({ weighing, effectiveNetGrams }: { weighing: WeighingDTO; effectiveNetGrams?: number | null }) {
  const changed = effectiveNetGrams != null && effectiveNetGrams !== weighing.netGrams;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-line bg-surface p-2">
          <dt className="text-xs text-muted">Brutto</dt>
          <dd className="font-semibold tabular-nums">{formatKg(weighing.grossGrams)}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-2">
          <dt className="text-xs text-muted">Tara</dt>
          <dd className="font-semibold tabular-nums">{formatKg(weighing.tareGrams)}</dd>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary-soft p-2">
          <dt className="text-xs text-muted">Sof vazn</dt>
          <dd className="font-bold tabular-nums">{formatKg(weighing.netGrams)}</dd>
        </div>
      </dl>
      {changed ? (
        <p className="text-sm font-semibold">
          Hisobda amaldagi vazn (bahs qarori bo‘yicha): <span className="tabular-nums">{formatKg(effectiveNetGrams)}</span>
        </p>
      ) : null}
      <p className="text-sm text-muted">
        Tortdi: {weighing.recordedByName} · {formatDateTime(weighing.recordedAt)}
      </p>
      <Thumbs items={weighing.photos} label="Tarozi rasmlari" />
    </div>
  );
}

export function ConfirmationLine({ confirmation }: { confirmation: StopDTO["confirmation"] }) {
  if (!confirmation) {
    return (
      <Badge tone="warning" icon="◷">
        Do‘kon tasdig‘i kutilmoqda
      </Badge>
    );
  }
  return confirmation.status === "CONFIRMED" ? (
    <p className="text-sm">
      <Badge tone="success" icon="✓">
        Do‘kon tasdiqladi
      </Badge>{" "}
      <span className="text-muted">
        {confirmation.byName} · {formatDateTime(confirmation.at)}
      </span>
    </p>
  ) : (
    <p className="text-sm">
      <Badge tone="danger" icon="⚠">
        Do‘kon e’tiroz bildirdi
      </Badge>{" "}
      <span className="text-muted">
        {confirmation.byName} · {formatDateTime(confirmation.at)}
        {confirmation.reason ? ` — ${uzText(confirmation.reason)}` : ""}
      </span>
    </p>
  );
}

/** Bahs tarixi (faqat o‘qish uchun). */
export function DisputeSummary({ dispute }: { dispute: DisputeDTO }) {
  return (
    <Card tone={dispute.status === "RESOLVED" ? "surface" : "danger"} className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="dispute" value={dispute.status} />
        <span className="text-sm text-muted">
          {dispute.openedByName} · {formatDateTime(dispute.createdAt)}
        </span>
      </div>
      <KeyValues
        rows={[
          { label: "Sabab", value: <span className="font-normal">{uzText(dispute.reason)}</span> },
          ...(dispute.claimedNetGrams !== null ? [{ label: "Da’vo qilingan vazn", value: formatKg(dispute.claimedNetGrams) }] : []),
          ...(dispute.decisionText
            ? [{ label: `Qaror${dispute.decidedByName ? ` (${dispute.decidedByName})` : ""}`, value: <span className="font-normal">{uzText(dispute.decisionText)}</span> }]
            : []),
          ...(dispute.decidedNetGrams !== null ? [{ label: "Yakuniy sof vazn", value: formatKg(dispute.decidedNetGrams), strong: true }] : []),
          ...(dispute.status !== "OPEN" || dispute.decisionText
            ? [
                { label: "Do‘kon roziligi", value: dispute.shopAckAt ? `✓ ${formatDateTime(dispute.shopAckAt)}` : "Kutilmoqda" },
                { label: "Yig‘uvchi roziligi", value: dispute.collectorAckAt ? `✓ ${formatDateTime(dispute.collectorAckAt)}` : "Kutilmoqda" },
              ]
            : []),
          ...(dispute.lastRejectComment ? [{ label: "Oxirgi e’tiroz izohi", value: <span className="font-normal">{uzText(dispute.lastRejectComment)}</span> }] : []),
        ]}
      />
    </Card>
  );
}

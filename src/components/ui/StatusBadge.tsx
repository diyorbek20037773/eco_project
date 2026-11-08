import type { ReactNode } from "react";
import type { DisputeStatus, PayState, RequestStatus, StopStatus, TripStatus } from "@/server/contract";
import {
  DISPUTE_STATUS_LABEL,
  DISPUTE_STATUS_TONE,
  PAY_STATE_LABEL,
  PAY_STATE_TONE,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  STOP_STATUS_LABEL,
  STOP_STATUS_TONE,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TONE,
  type Tone,
} from "@/domain/labels";
import { cx } from "./cx";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-ink border-line-strong",
  info: "bg-info-soft text-info border-[#7ddde6]",
  progress: "bg-primary-soft text-primary border-primary/30",
  success: "bg-primary text-white border-primary",
  warning: "bg-amber-soft text-amber border-amber/40",
  danger: "bg-danger-soft text-danger border-danger/50",
  muted: "bg-canvas text-muted border-line",
};

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold leading-6",
        TONE[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="min-w-0 [overflow-wrap:normal]">{children}</span>
    </span>
  );
}

type StatusProps =
  | { kind: "request"; value: RequestStatus }
  | { kind: "trip"; value: TripStatus }
  | { kind: "stop"; value: StopStatus }
  | { kind: "dispute"; value: DisputeStatus }
  | { kind: "pay"; value: PayState };

/** Holat belgisi: doim matn + rang; bahsda ⚠, kechikish/to‘lov kutishda soat belgisi. */
export function StatusBadge(props: StatusProps & { className?: string }) {
  let label: string;
  let tone: Tone;
  let icon: string | undefined;
  switch (props.kind) {
    case "request":
      label = REQUEST_STATUS_LABEL[props.value];
      tone = REQUEST_STATUS_TONE[props.value];
      if (props.value === "DISPUTED") icon = "⚠";
      if (props.value === "CONFIRMED" || props.value === "SETTLED") icon = "✓";
      break;
    case "trip":
      label = TRIP_STATUS_LABEL[props.value];
      tone = TRIP_STATUS_TONE[props.value];
      if (props.value === "AWAITING_PAYMENT") icon = "◷";
      if (props.value === "CLOSED") icon = "✓";
      break;
    case "stop":
      label = STOP_STATUS_LABEL[props.value];
      tone = STOP_STATUS_TONE[props.value];
      if (props.value === "COLLECTED") icon = "✓";
      break;
    case "dispute":
      label = DISPUTE_STATUS_LABEL[props.value];
      tone = DISPUTE_STATUS_TONE[props.value];
      icon = props.value === "RESOLVED" ? "✓" : "⚠";
      break;
    case "pay":
      label = PAY_STATE_LABEL[props.value];
      tone = PAY_STATE_TONE[props.value];
      if (props.value === "PAID") icon = "✓";
      if (props.value === "OVERPAID") icon = "⚠";
      break;
  }
  return (
    <Badge tone={tone} icon={icon} className={props.className}>
      {label}
    </Badge>
  );
}

/** Kechikish: to‘ldirilgan sariq belgi, to‘q matn — rang yagona signal emas (soat belgisi + so‘z). */
export function LateBadge() {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-sun-line bg-sun px-2.5 py-0.5 text-sm font-semibold leading-6 text-ink">
      <span aria-hidden="true">◷</span>
      <span className="min-w-0 [overflow-wrap:normal]">Kechikmoqda</span>
    </span>
  );
}

export function DisputeFlag({ children = "Bahs" }: { children?: ReactNode }) {
  return (
    <Badge tone="danger" icon="⚠">
      {children}
    </Badge>
  );
}

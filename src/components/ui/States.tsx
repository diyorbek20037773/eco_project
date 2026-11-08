import type { ReactNode } from "react";
import { cx } from "./cx";

export function EmptyState({ title, children, action, icon }: { title: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface px-4 py-8 text-center">
      {icon ? <div className="mx-auto mb-2 flex justify-center text-muted">{icon}</div> : null}
      <p className="text-lg font-bold">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-md text-muted">{children}</div> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export type NoticeTone = "info" | "success" | "warning" | "danger";

const NOTICE: Record<NoticeTone, { cls: string; icon: string }> = {
  info: { cls: "bg-info-soft border-info/30 text-info", icon: "ℹ" },
  success: { cls: "bg-primary-soft border-primary/40 text-primary", icon: "✓" },
  warning: { cls: "bg-amber-soft border-amber/40 text-amber", icon: "◷" },
  danger: { cls: "bg-danger-soft border-danger/50 text-danger", icon: "⚠" },
};

/** Xabar bloki. `live` bo‘lsa ekran o‘quvchi uchun aria-live. */
export function Notice({
  tone = "info",
  title,
  children,
  actions,
  live,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  live?: "polite" | "assertive";
  className?: string;
}) {
  const n = NOTICE[tone];
  return (
    <div
      role={tone === "danger" && live ? "alert" : live ? "status" : undefined}
      aria-live={live}
      className={cx("flex gap-3 rounded-xl border px-3 py-3", n.cls, className)}
    >
      <span aria-hidden="true" className="mt-0.5 text-lg leading-none">
        {n.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="text-ink">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-xl bg-line/70", className)} />;
}

/** Sahifa yuklanish skeleti (loading.tsx). */
export function PageSkeleton({ rows = 3, label = "Yuklanmoqda…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-28 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

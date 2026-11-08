import type { ReactNode } from "react";
import { cx } from "./cx";

export function Card({
  children,
  className,
  tone = "surface",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "kraft" | "warning" | "danger" | "primary";
  as?: "div" | "section" | "article" | "li";
  "aria-labelledby"?: string;
}) {
  const toneCls = {
    surface: "bg-surface border-line",
    kraft: "bg-kraft border-kraft-line",
    warning: "bg-amber-soft border-amber/40",
    danger: "bg-danger-soft border-danger/50",
    primary: "bg-primary-soft border-primary/30",
  }[tone];
  return (
    <Tag className={cx("min-w-0 rounded-card border p-4 shadow-[0_1px_0_rgba(23,57,46,0.04)]", toneCls, className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Section({
  title,
  id,
  actions,
  description,
  children,
  className,
}: {
  title: ReactNode;
  id?: string;
  actions?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} id={id} className={cx("min-w-0 space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function PageTitle({ children, sub, actions }: { children: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-ink">{children}</h1>
        {sub ? <div className="mt-1 text-muted">{sub}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Kalit–qiymat qatorlari (kvitansiya, tafsilotlar). Raqamlar o‘ngda, tabular. */
export function KeyValues({ rows, className }: { rows: { label: ReactNode; value: ReactNode; strong?: boolean }[]; className?: string }) {
  return (
    <dl className={cx("divide-y divide-line/70", className)}>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
          <dt className={cx("min-w-0 text-muted", r.strong && "font-semibold text-ink")}>{r.label}</dt>
          <dd className={cx("min-w-0 text-right tabular-nums", r.strong ? "text-lg font-bold" : "font-semibold")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Katta raqamli ko‘rsatkich. */
export function Stat({ label, value, hint, tone = "surface" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "surface" | "kraft" | "warning" | "danger" | "primary" }) {
  return (
    <Card tone={tone} className="p-3">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-sm text-muted">{hint}</div> : null}
    </Card>
  );
}

/**
 * Bir nechta raqamli ko‘rsatkich: telefonda qatorma-qator (yorliq chapda, qiymat o‘ngda),
 * ≥640px da yonma-yon ustunlar. Uzun summalar ("144 000 so‘m") bo‘linmaydi.
 */
export function StatRow({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cx("grid gap-2 sm:grid-cols-3", className)}>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 sm:flex-col sm:items-center sm:justify-start sm:gap-0 sm:text-center"
        >
          <dt className="text-sm text-muted">{it.label}</dt>
          <dd className="whitespace-nowrap font-bold tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

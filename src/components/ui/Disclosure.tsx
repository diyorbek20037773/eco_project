import type { ReactNode } from "react";
import { cx } from "./cx";

/** JS’siz ochiladigan blok (<details>). Sarlavha ≥ 44px. */
export function Disclosure({ summary, children, defaultOpen, className }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={cx("group rounded-xl border border-line bg-surface", className)}>
      <summary className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 font-semibold text-primary hover:bg-primary-soft">
        <span className="min-w-0">{summary}</span>
        <span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-line p-3">{children}</div>
    </details>
  );
}

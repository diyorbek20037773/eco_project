"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  badgeLabel?: string;
  /** faqat aniq moslik (masalan /operator navbat uchun) */
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href || (item.href === "/operator" && pathname === "/operator/");
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Operator desktop chap navigatsiyasi. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold",
                active ? "bg-primary text-white" : "text-ink hover:bg-primary-soft",
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className={cx(
                    "min-w-7 rounded-full px-2 text-center text-sm tabular-nums",
                    active ? "bg-white text-primary" : "bg-kraft text-ink",
                  )}
                >
                  {item.badge}
                  {item.badgeLabel ? <span className="sr-only"> {item.badgeLabel}</span> : null}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Operator mobil pastki navigatsiyasi (4 band, ≥ 44px). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="grid grid-cols-4">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href} className="min-w-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold",
                active ? "text-primary" : "text-muted hover:text-ink",
              )}
            >
              <span aria-hidden="true" className={cx("h-1 w-8 rounded-full", active ? "bg-primary" : "bg-transparent")} />
              {item.icon}
              <span className="max-w-full truncate">{item.label}</span>
              {item.badge ? (
                <span className="absolute right-[18%] top-1.5 min-w-5 rounded-full bg-kraft px-1 text-center text-[11px] leading-5 text-ink tabular-nums">
                  {item.badge}
                  {item.badgeLabel ? <span className="sr-only"> {item.badgeLabel}</span> : null}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

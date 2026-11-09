"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/server/actions/locale";
import { LOCALES, LOCALE_NAME, LOCALE_SHORT, type Locale } from "@/i18n/config";
import { cx } from "@/components/ui/cx";

/** UZ / RU / EN almashtirgich — tanlov cookie’da saqlanadi, sahifa yangilanadi. */
export function LanguageSwitcher({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={label} className={cx("inline-flex rounded-full border border-line-strong bg-surface p-0.5", className)}>
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            title={LOCALE_NAME[l]}
            disabled={pending}
            onClick={() => {
              if (active) return;
              start(async () => {
                await setLocaleAction(l);
                router.refresh();
              });
            }}
            className={cx(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-sm font-bold",
              active ? "bg-mint text-ink" : "text-ink hover:bg-mint-soft",
            )}
          >
            <span aria-hidden="true">{LOCALE_SHORT[l]}</span>
            <span className="sr-only">{LOCALE_NAME[l]}</span>
          </button>
        );
      })}
    </div>
  );
}

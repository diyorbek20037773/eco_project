"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "./Button";
import { IconRefresh } from "./icons";
import { fmt } from "@/i18n/config";
import { COMMON_DICT } from "@/i18n/common";
import { useDict } from "@/i18n/LocaleProvider";

/** error.tsx uchun umumiy ko‘rinish: nima bo‘ldi + nima qilish kerak + «Qayta urinish». */
export function ErrorState({
  error,
  retry,
  title,
  homeHref,
}: {
  error: unknown;
  retry: () => void;
  title?: string;
  homeHref?: string;
}) {
  const t = useDict(COMMON_DICT).error;
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div role="alert" className="rounded-card border border-danger/50 bg-danger-soft px-4 py-6">
      <p className="flex items-center gap-2 text-lg font-bold text-danger">
        <span aria-hidden="true">⚠</span>
        {title ?? t.title}
      </p>
      <p className="mt-1 text-ink">
        {offline ? t.offline : t.server}
      </p>
      {digest ? <p className="mt-1 text-sm text-muted">{fmt(t.code, { code: digest })}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => retry()} icon={<IconRefresh />}>
          {t.retry}
        </Button>
        {homeHref ? (
          <LinkButton href={homeHref} variant="secondary">
            {t.home}
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

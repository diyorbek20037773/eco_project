"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "./Button";
import { IconRefresh } from "./icons";

/** error.tsx uchun umumiy ko‘rinish: nima bo‘ldi + nima qilish kerak + «Qayta urinish». */
export function ErrorState({
  error,
  retry,
  title = "Sahifani ochib bo‘lmadi",
  homeHref,
}: {
  error: unknown;
  retry: () => void;
  title?: string;
  homeHref?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div role="alert" className="rounded-card border border-danger/50 bg-danger-soft px-4 py-6">
      <p className="flex items-center gap-2 text-lg font-bold text-danger">
        <span aria-hidden="true">⚠</span>
        {title}
      </p>
      <p className="mt-1 text-ink">
        {offline
          ? "Internet aloqasi yo‘q. Aloqa tiklangach «Qayta urinish»ni bosing."
          : "Server bilan bog‘lanishda xato yuz berdi. Kiritilgan ma’lumotlar yo‘qolmaydi — «Qayta urinish»ni bosing."}
      </p>
      {digest ? <p className="mt-1 text-sm text-muted">Xato kodi: {digest}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => retry()} icon={<IconRefresh />}>
          Qayta urinish
        </Button>
        {homeHref ? (
          <LinkButton href={homeHref} variant="secondary">
            Bosh sahifaga
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { dismissFlash, readFlash, subscribeFlash } from "@/lib/client/flash";
import { IconCheck, IconX } from "./icons";
import { COMMON_DICT } from "@/i18n/common";
import { useDict } from "@/i18n/LocaleProvider";

const AUTO_HIDE_MS = 7000;

/** Muvaffaqiyat xabari: forma ekrandan yo‘qolsa ham foydalanuvchi natijani ko‘radi. */
export function FlashToast() {
  const msg = useSyncExternalStore(subscribeFlash, readFlash, () => null);
  const t = useDict(COMMON_DICT).toast;

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => dismissFlash(msg.id), AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [msg]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6">
      {msg ? (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary bg-primary-soft py-1 pl-4 pr-1 text-ink shadow-lg">
          <IconCheck size={20} className="shrink-0 text-primary" />
          <p className="min-w-0 py-2 font-semibold">{msg.text}</p>
          <button
            type="button"
            onClick={() => dismissFlash(msg.id)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface"
            aria-label={t.close}
          >
            <IconX size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

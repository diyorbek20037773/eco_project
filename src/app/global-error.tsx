"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";
import { COMMON_DICT } from "@/i18n/common";

// Ildiz layout (va LocaleProvider) ishlamay qolganda tilni to‘g‘ridan-to‘g‘ri cookie’dan o‘qiymiz.
function readCookieLocale(): Locale {
  const m = document.cookie.match(new RegExp(`(?:^|;\s*)${LOCALE_COOKIE}=([^;]*)`));
  const v = m?.[1] ? decodeURIComponent(m[1]) : undefined;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
const noopSubscribe = () => () => {};

// Ildiz layout ishlamay qolganda: o‘z <html>/<body> va inline uslublar bilan.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const locale = useSyncExternalStore(noopSubscribe, readCookieLocale, () => DEFAULT_LOCALE);
  const t = COMMON_DICT[locale].globalError;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#F7F7F2",
          color: "#17392E",
          fontFamily: 'Inter, "Segoe UI", Roboto, system-ui, sans-serif',
        }}
      >
        <title>{t.docTitle}</title>
        <main style={{ maxWidth: 440, margin: "0 auto", padding: "48px 16px" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t.title}</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>{t.body}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 20px",
              borderRadius: 12,
              border: "none",
              background: "#176947",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
        </main>
      </body>
    </html>
  );
}

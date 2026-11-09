import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { FlashToast } from "@/components/ui/FlashToast";
import { getLocale } from "@/i18n/server";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Eco Point · Qarshi karton piloti", template: "%s · Eco Point" },
  description: "Savdo nuqtalaridan toza kartonni kelishilgan vaqtda olib ketish, reys, xaridor qabuli va hisob-kitob.",
  applicationName: "Eco Point",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#176947",
};

const SKIP_LINK = { uz: "Asosiy qismga o‘tish", ru: "Перейти к содержимому", en: "Skip to content" } as const;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold"
        >
          {SKIP_LINK[locale]}
        </a>
        <LocaleProvider locale={locale}>
          {children}
          <FlashToast />
        </LocaleProvider>
      </body>
    </html>
  );
}

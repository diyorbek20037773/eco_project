import Link from "next/link";
import type { SessionUser } from "@/server/contract";
import { logoutAction } from "@/server/actions/auth";
import { getDict } from "@/i18n/server";
import { COMMON_DICT } from "@/i18n/common";
import { labelsFor } from "@/i18n/labels";
import { homeFor } from "@/lib/routes";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { IconLogout } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

export function LogoutButton({
  className,
  tone = "default",
  label = "Chiqish",
  iconOnlyOnMobile = false,
}: {
  className?: string;
  tone?: "default" | "mint";
  label?: string;
  /** Tor ekranda faqat ikonka (yozuv ekran o‘quvchiga qoladi), ≥ sm — ikonka + yozuv. */
  iconOnlyOnMobile?: boolean;
}) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={cx(
          "inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-surface px-3 text-sm font-semibold text-ink",
          tone === "mint" ? "border-2 border-mint hover:bg-mint-soft" : "border-line-strong hover:bg-primary-soft",
          className,
        )}
      >
        <IconLogout size={18} />
        <span className={iconOnlyOnMobile ? "sr-only sm:not-sr-only" : undefined}>{label}</span>
      </button>
    </form>
  );
}

/**
 * Do‘kon va yig‘uvchi sarlavhasi: belgi, til almashtirgich, «Chiqish», kim kirgan.
 * Telefonda (< 640px) kim kirgani ikkinchi qatorga tushadi — 360 px’da ham hech narsa siqilmaydi.
 */
export async function AppHeader({ user, maxWidth = "max-w-xl" }: { user: SessionUser; maxWidth?: string }) {
  const { locale, t } = await getDict();
  const who = user.role === "SHOP" && user.shopName ? user.shopName : labelsFor(locale).role[user.role];
  return (
    <header className="border-b border-line bg-surface">
      <div className={cx("mx-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2", maxWidth)}>
        <Link
          href={homeFor(user.role)}
          className="mr-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg sm:justify-start"
          aria-label={COMMON_DICT[locale].header.home}
        >
          <LogoMark size={30} className="sm:hidden" />
          <span className="hidden sm:inline-flex">
            <Logo size={30} />
          </span>
        </Link>
        <div className="order-last w-full min-w-0 pb-1 text-sm leading-tight sm:order-none sm:w-auto sm:flex-1 sm:pb-0 sm:text-right">
          <div className="truncate" title={`${user.name} · ${who}`}>
            <span className="font-semibold sm:block sm:truncate">{user.name}</span>
            <span className="text-muted sm:hidden"> · </span>
            <span className="text-muted sm:block sm:truncate sm:text-xs">{who}</span>
          </div>
        </div>
        <LanguageSwitcher locale={locale} label={t.common.language} />
        <LogoutButton label={t.common.logout} iconOnlyOnMobile className="min-w-11 justify-center" />
      </div>
    </header>
  );
}

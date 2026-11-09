import Link from "next/link";
import type { SessionUser } from "@/server/contract";
import { logoutAction } from "@/server/actions/auth";
import { ROLE_LABEL } from "@/domain/labels";
import { homeFor } from "@/lib/routes";
import { Logo } from "@/components/ui/Logo";
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

/** Do‘kon va yig‘uvchi sarlavhasi: belgi, kim kirgan, «Chiqish». */
export function AppHeader({ user, maxWidth = "max-w-xl" }: { user: SessionUser; maxWidth?: string }) {
  const who = user.role === "SHOP" && user.shopName ? user.shopName : ROLE_LABEL[user.role];
  return (
    <header className="border-b border-line bg-surface">
      <div className={cx("mx-auto flex items-center justify-between gap-3 px-4 py-2", maxWidth)}>
        <Link href={homeFor(user.role)} className="inline-flex min-h-11 items-center rounded-lg" aria-label="Eco Point — bosh sahifa">
          <Logo size={30} />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 text-right leading-tight">
            <div className="truncate text-sm font-semibold" title={user.name}>
              {user.name}
            </div>
            <div className="truncate text-xs text-muted" title={who}>
              {who}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

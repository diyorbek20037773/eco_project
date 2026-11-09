import type { ReactNode } from "react";
import Link from "next/link";
import type { AppInfo, OperatorDashboardCounts, SessionUser } from "@/server/contract";
import { getAppInfo, requireUser } from "@/server/queries/session";
import { getOperatorCounts } from "@/server/queries/operator";
import { getDict } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { IconBox, IconInfo, IconList, IconMapPin, IconShield, IconTruck } from "@/components/ui/icons";
import { LogoutButton } from "@/components/shell/AppHeader";
import { BottomNav, SideNav, type NavItem } from "@/components/shell/NavLink";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const user: SessionUser = await requireUser("OPERATOR");
  const info: AppInfo = getAppInfo();
  const counts: OperatorDashboardCounts = await getOperatorCounts();
  const { locale, t } = await getDict();
  const tripAttention = counts.awaitingAcceptance + counts.awaitingPayment + counts.openDisputes;
  const initial = user.name.trim().charAt(0).toUpperCase() || "O";

  const items: NavItem[] = [
    { href: routes.operator.queue, label: t.nav.queue, icon: <IconList size={22} />, badge: counts.queue, badgeLabel: t.nav.queueBadge, exact: true },
    { href: routes.operator.trips, label: t.nav.trips, icon: <IconTruck size={22} />, badge: counts.activeTrips, badgeLabel: t.nav.tripsBadge },
    { href: routes.operator.directory, label: t.nav.catalog, icon: <IconBox size={22} /> },
    { href: routes.operator.audit, label: t.nav.audit, icon: <IconShield size={22} /> },
  ];

  return (
    <div className="min-h-dvh bg-surface">
      {info.demoMode ? (
        <div className="lg:hidden">
          <DemoBanner text={t.common.demoNote} />
        </div>
      ) : null}

      {/* Desktop: chap navigatsiya */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface lg:flex" aria-label={t.nav.menu}>
        <div className="px-5 pb-6 pt-6">
          <Link href={routes.operator.queue} className="inline-flex min-h-11 items-center rounded-lg" aria-label={`Eco Point — ${t.nav.queue}`}>
            <Logo size={40} className="[&>span:last-child]:text-2xl" />
          </Link>
        </div>
        <nav className="flex-1 px-3" aria-label={t.nav.main}>
          <SideNav items={items} />
        </nav>
        <div className="mx-4 border-t border-line py-4">
          <div className="mb-3 flex items-center gap-3">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-soft text-lg font-bold text-ink">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold" title={user.name}>
                {user.name}
              </span>
              <span className="block text-sm text-muted">{t.common.operator}</span>
            </span>
          </div>
          <LogoutButton tone="mint" className="w-full justify-center" label={t.common.logout} />
        </div>
      </aside>

      {/* Mobil/planshet: yuqori sarlavha */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <Link href={routes.operator.queue} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg sm:justify-start" aria-label={`Eco Point — ${t.nav.queue}`}>
            <LogoMark size={30} className="sm:hidden" />
            <span className="hidden sm:inline-flex">
              <Logo size={28} />
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {tripAttention > 0 ? (
              <Link
                href={routes.operator.trips}
                className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-1.5 text-sm font-semibold text-amber"
                aria-label={fmt(t.nav.attention, { n: tripAttention })}
                title={fmt(t.nav.attention, { n: tripAttention })}
              >
                ◷ {tripAttention}
              </Link>
            ) : null}
            <LanguageSwitcher locale={locale} label={t.common.language} />
            <LogoutButton label={t.common.logout} iconOnlyOnMobile />
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 px-4 pb-24 pt-4 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-6">
        <div className="mx-auto max-w-[1360px]">
          {/* Desktop: sahifa sarlavhasi bilan bir qatorda — til, pilot hududi va demo belgisi */}
          <div className="float-right ml-4 hidden items-center gap-4 lg:flex">
            <LanguageSwitcher locale={locale} label={t.common.language} />
            <span className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold" title={t.common.cityHint}>
              <IconMapPin size={22} />
              {t.common.city}
            </span>
            {info.demoMode ? (
              <>
                <span aria-hidden="true" className="h-8 w-px bg-line" />
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm font-semibold" title={t.common.demoNote}>
                  <IconInfo size={18} />
                  {t.common.demoMode}
                  <span className="sr-only">: {t.common.demoNote}</span>
                </span>
              </>
            ) : null}
          </div>
          {children}
        </div>
      </main>

      {/* Mobil: pastki navigatsiya */}
      <nav aria-label={t.nav.main} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <BottomNav items={items} />
      </nav>
    </div>
  );
}

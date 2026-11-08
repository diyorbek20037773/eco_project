import type { ReactNode } from "react";
import Link from "next/link";
import type { AppInfo, OperatorDashboardCounts, SessionUser } from "@/server/contract";
import { getAppInfo, requireUser } from "@/server/queries/session";
import { getOperatorCounts } from "@/server/queries/operator";
import { routes } from "@/lib/routes";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Logo } from "@/components/ui/Logo";
import { IconBook, IconHistory, IconList, IconTruck } from "@/components/ui/icons";
import { LogoutButton } from "@/components/shell/AppHeader";
import { BottomNav, SideNav, type NavItem } from "@/components/shell/NavLink";

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const user: SessionUser = await requireUser("OPERATOR");
  const info: AppInfo = getAppInfo();
  const counts: OperatorDashboardCounts = await getOperatorCounts();
  const tripAttention = counts.awaitingAcceptance + counts.awaitingPayment + counts.openDisputes;

  const items: NavItem[] = [
    { href: routes.operator.queue, label: "Navbat", icon: <IconList />, badge: counts.queue, badgeLabel: "ta buyurtma navbatda", exact: true },
    { href: routes.operator.trips, label: "Reyslar", icon: <IconTruck />, badge: counts.activeTrips, badgeLabel: "ta faol reys" },
    { href: routes.operator.directory, label: "Katalog", icon: <IconBook /> },
    { href: routes.operator.audit, label: "Audit", icon: <IconHistory /> },
  ];

  return (
    <div className="min-h-dvh">
      {info.demoMode ? <DemoBanner /> : null}

      {/* Desktop: chap navigatsiya */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface lg:flex" aria-label="Operator menyusi">
        <div className="px-4 pb-3 pt-4">
          <Link href={routes.operator.queue} className="inline-flex min-h-11 items-center rounded-lg" aria-label="Eco Point — navbat">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 px-3" aria-label="Asosiy">
          <SideNav items={items} />
          <dl className="mt-6 space-y-1 rounded-xl bg-canvas p-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Qabul kutilmoqda</dt>
              <dd className="font-semibold tabular-nums">{counts.awaitingAcceptance}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">To‘lov kutilmoqda</dt>
              <dd className="font-semibold tabular-nums">{counts.awaitingPayment}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className={counts.openDisputes ? "font-semibold text-danger" : "text-muted"}>
                {counts.openDisputes ? "⚠ " : ""}Ochiq bahslar
              </dt>
              <dd className="font-semibold tabular-nums">{counts.openDisputes}</dd>
            </div>
          </dl>
        </nav>
        <div className="border-t border-line p-3">
          <p className="truncate text-sm font-semibold" title={user.name}>
            {user.name}
          </p>
          <p className="mb-2 text-xs text-muted">Operator</p>
          <LogoutButton className="w-full justify-center" />
        </div>
      </aside>

      {/* Mobil/planshet: yuqori sarlavha */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <Link href={routes.operator.queue} className="inline-flex min-h-11 items-center rounded-lg" aria-label="Eco Point — navbat">
            <Logo size={28} />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {tripAttention > 0 ? (
              <Link href={routes.operator.trips} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-amber">
                ◷ {tripAttention} ta e’tibor
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 px-4 pb-24 pt-4 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-6">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* Mobil: pastki navigatsiya */}
      <nav
        aria-label="Asosiy"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <BottomNav items={items} />
      </nav>
    </div>
  );
}

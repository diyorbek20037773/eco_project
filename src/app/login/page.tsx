import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AppInfo, DemoAccount, SessionUser } from "@/server/contract";
import { getAppInfo, getDemoAccounts, getSessionUser } from "@/server/queries/session";
import { getDict } from "@/i18n/server";
import { homeFor } from "@/lib/routes";
import { Logo } from "@/components/ui/Logo";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { TeamCard } from "@/components/TeamCard";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.login.metaTitle };
}

export default async function LoginPage() {
  const user: SessionUser | null = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  const info: AppInfo = getAppInfo();
  const demoAccounts: DemoAccount[] = info.demoMode ? getDemoAccounts() : [];
  const { locale, t } = await getDict();

  return (
    <>
      {info.demoMode ? <DemoBanner text={t.common.demoNote} /> : null}
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-10 pt-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Logo size={40} />
          <LanguageSwitcher locale={locale} label={t.common.language} />
        </div>
        <h1 className="text-2xl font-bold">{t.login.title}</h1>
        <p className="mb-6 mt-1 text-muted">{t.login.subtitle}</p>
        <LoginForm demoAccounts={demoAccounts} t={t.login} />
        <TeamCard team={t.team} compact className="mt-8" />
      </main>
    </>
  );
}

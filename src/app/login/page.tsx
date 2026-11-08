import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AppInfo, DemoAccount, SessionUser } from "@/server/contract";
import { getAppInfo, getDemoAccounts, getSessionUser } from "@/server/queries/session";
import { homeFor } from "@/lib/routes";
import { Logo } from "@/components/ui/Logo";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Kirish" };

export default async function LoginPage() {
  const user: SessionUser | null = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  const info: AppInfo = getAppInfo();
  const demoAccounts: DemoAccount[] = info.demoMode ? getDemoAccounts() : [];

  return (
    <>
      {info.demoMode ? <DemoBanner /> : null}
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-10 pt-8">
        <Logo size={40} className="mb-6" />
        <h1 className="text-2xl font-bold">Tizimga kirish</h1>
        <p className="mb-6 mt-1 text-muted">Qarshi karton piloti: do‘kon, yig‘uvchi va operator uchun.</p>
        <LoginForm demoAccounts={demoAccounts} />
      </main>
    </>
  );
}

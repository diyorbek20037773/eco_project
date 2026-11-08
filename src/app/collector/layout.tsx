import type { ReactNode } from "react";
import type { AppInfo, SessionUser } from "@/server/contract";
import { getAppInfo, requireUser } from "@/server/queries/session";
import { AppHeader } from "@/components/shell/AppHeader";
import { DemoBanner } from "@/components/ui/DemoBanner";

export default async function CollectorLayout({ children }: { children: ReactNode }) {
  const user: SessionUser = await requireUser("COLLECTOR");
  const info: AppInfo = getAppInfo();
  return (
    <>
      {info.demoMode ? <DemoBanner /> : null}
      <AppHeader user={user} />
      <main id="main" className="mx-auto w-full max-w-xl px-4 pb-12 pt-4">
        {children}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import type { AuditDTO } from "@/server/contract";
import { getAudit } from "@/server/queries/operator";
import { PageTitle } from "@/components/ui/Card";
import { AuditList } from "@/components/operator/AuditList";
import { getLocale } from "@/i18n/server";
import { OPERATOR_DICT } from "@/i18n/operator";

export async function generateMetadata(): Promise<Metadata> {
  return { title: OPERATOR_DICT[await getLocale()].audit.metaTitle };
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tripId = typeof sp.tripId === "string" && sp.tripId ? sp.tripId : undefined;
  const [items, locale]: [AuditDTO[], Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getAudit({ tripId, limit: 200 }), getLocale()]);
  const t = OPERATOR_DICT[locale].audit;

  return (
    <div className="space-y-4">
      <PageTitle sub={t.sub}>{t.title}</PageTitle>
      <AuditList items={items} showTrip locale={locale} />
    </div>
  );
}

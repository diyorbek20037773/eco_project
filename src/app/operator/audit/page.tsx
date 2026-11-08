import type { Metadata } from "next";
import type { AuditDTO } from "@/server/contract";
import { getAudit } from "@/server/queries/operator";
import { PageTitle } from "@/components/ui/Card";
import { AuditList } from "@/components/operator/AuditList";

export const metadata: Metadata = { title: "Audit" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tripId = typeof sp.tripId === "string" && sp.tripId ? sp.tripId : undefined;
  const items: AuditDTO[] = await getAudit({ tripId, limit: 200 });

  return (
    <div className="space-y-4">
      <PageTitle sub="Har bir o‘zgarish: kim, qachon, nima; tuzatishlarda avvalgi va yangi qiymat hamda sabab. Oxirgi 200 ta yozuv.">Audit</PageTitle>
      <AuditList items={items} showTrip />
    </div>
  );
}

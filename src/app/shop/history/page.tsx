import type { Metadata } from "next";
import type { ShopHistory } from "@/server/contract";
import { getShopHistory } from "@/server/queries/shop";
import { routes } from "@/lib/routes";
import { PageTitle, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { IconChevronLeft, IconPlus } from "@/components/ui/icons";
import { ReceiptCard } from "@/components/shop/Receipt";
import { RequestCard } from "@/components/shop/RequestCard";

export const metadata: Metadata = { title: "Tarix" };

export default async function ShopHistoryPage() {
  const history: ShopHistory = await getShopHistory();
  const empty = history.receipts.length === 0 && history.requests.length === 0;

  return (
    <div className="space-y-6">
      <TextLink href={routes.shop.home}>
        <IconChevronLeft size={18} /> Bosh sahifa
      </TextLink>
      <PageTitle sub="Topshirishlar, summalar va to‘lov holati">Tarix</PageTitle>

      {empty ? (
        <EmptyState
          title="Hali tarix yo‘q"
          action={
            <LinkButton href={routes.shop.newRequest} icon={<IconPlus />}>
              Olib keting
            </LinkButton>
          }
        >
          Birinchi buyurtmani yuboring — topshirishlar shu yerda yig‘iladi.
        </EmptyState>
      ) : (
        <>
          <Section id="receipts" title="Kvitansiyalar">
            {history.receipts.length > 0 ? (
              <ul className="space-y-3">
                {history.receipts.map((rc) => (
                  <li key={rc.stopId}>
                    <ReceiptCard receipt={rc} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Hali tortilgan topshirish yo‘q.</p>
            )}
          </Section>
          <Section id="requests" title="Barcha buyurtmalar">
            <ul className="space-y-2">
              {history.requests.map((r) => (
                <li key={r.id}>
                  <RequestCard r={r} />
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}

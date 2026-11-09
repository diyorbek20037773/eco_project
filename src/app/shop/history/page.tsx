import type { Metadata } from "next";
import type { ShopHistory } from "@/server/contract";
import { getShopHistory } from "@/server/queries/shop";
import { getLocale } from "@/i18n/server";
import { SHOP_DICT } from "@/i18n/shop";
import { routes } from "@/lib/routes";
import { PageTitle, Section } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { IconChevronLeft, IconPlus } from "@/components/ui/icons";
import { ReceiptCard } from "@/components/shop/Receipt";
import { RequestCard } from "@/components/shop/RequestCard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.history };
}

export default async function ShopHistoryPage() {
  const [history, locale]: [ShopHistory, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getShopHistory(), getLocale()]);
  const t = SHOP_DICT[locale];
  const h = t.history;
  const empty = history.receipts.length === 0 && history.requests.length === 0;

  return (
    <div className="space-y-6">
      <TextLink href={routes.shop.home}>
        <IconChevronLeft size={18} /> {t.c.home}
      </TextLink>
      <PageTitle sub={h.sub}>{h.title}</PageTitle>

      {empty ? (
        <EmptyState
          title={h.emptyTitle}
          action={
            <LinkButton href={routes.shop.newRequest} icon={<IconPlus />}>
              {t.home.cta}
            </LinkButton>
          }
        >
          {h.emptyBody}
        </EmptyState>
      ) : (
        <>
          <Section id="receipts" title={h.receipts}>
            {history.receipts.length > 0 ? (
              <ul className="space-y-3">
                {history.receipts.map((rc) => (
                  <li key={rc.stopId}>
                    <ReceiptCard receipt={rc} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{h.noReceipts}</p>
            )}
          </Section>
          <Section id="requests" title={h.allRequests}>
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

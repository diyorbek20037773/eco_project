import type { Metadata } from "next";
import type { ShopHome } from "@/server/contract";
import { getShopHome } from "@/server/queries/shop";
import { addDays, tashkentToday } from "@/domain/time";
import { getLocale } from "@/i18n/server";
import { SHOP_DICT } from "@/i18n/shop";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { IconChevronLeft } from "@/components/ui/icons";
import { NewRequestForm } from "@/components/shop/NewRequestForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.newRequest };
}

export default async function NewRequestPage() {
  const [home, locale]: [ShopHome, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getShopHome(), getLocale()]);
  const t = SHOP_DICT[locale];
  const today = tashkentToday();
  const tomorrow = addDays(today, 1);

  return (
    <div>
      <TextLink href={routes.shop.home} className="mb-2">
        <IconChevronLeft size={18} /> {t.c.home}
      </TextLink>
      <PageTitle sub={t.newPage.sub}>{t.newPage.title}</PageTitle>
      {home.points.length === 0 ? (
        <EmptyState title={t.newPage.noPointsTitle}>{t.newPage.noPointsBody}</EmptyState>
      ) : (
        <NewRequestForm points={home.points} today={today} tomorrow={tomorrow} />
      )}
    </div>
  );
}

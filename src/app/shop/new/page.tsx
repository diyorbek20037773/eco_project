import type { Metadata } from "next";
import type { ShopHome } from "@/server/contract";
import { getShopHome } from "@/server/queries/shop";
import { addDays, tashkentToday } from "@/domain/time";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { IconChevronLeft } from "@/components/ui/icons";
import { NewRequestForm } from "@/components/shop/NewRequestForm";

export const metadata: Metadata = { title: "Olib keting" };

export default async function NewRequestPage() {
  const home: ShopHome = await getShopHome();
  const today = tashkentToday();
  const tomorrow = addDays(today, 1);

  return (
    <div>
      <TextLink href={routes.shop.home} className="mb-2">
        <IconChevronLeft size={18} /> Bosh sahifa
      </TextLink>
      <PageTitle sub="Karton qachon tayyor bo‘lishini ayting — operator reysga qo‘shadi.">Olib keting</PageTitle>
      {home.points.length === 0 ? (
        <EmptyState title="Saqlangan nuqta yo‘q">
          Do‘koningizga hali olib ketish nuqtasi qo‘shilmagan. Eco Point operatoriga murojaat qiling.
        </EmptyState>
      ) : (
        <NewRequestForm points={home.points} today={today} tomorrow={tomorrow} />
      )}
    </div>
  );
}

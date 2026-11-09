import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { getLocale } from "@/i18n/server";
import { SHOP_DICT } from "@/i18n/shop";
import { routes } from "@/lib/routes";

export default async function ShopNotFound() {
  const t = SHOP_DICT[await getLocale()];
  return (
    <EmptyState
      title={t.notFound.shopTitle}
      action={
        <LinkButton href={routes.shop.home} size="lg">
          {t.c.toHome}
        </LinkButton>
      }
    >
      {t.notFound.shopBody}
    </EmptyState>
  );
}

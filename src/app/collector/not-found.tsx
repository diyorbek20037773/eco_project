import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { getLocale } from "@/i18n/server";
import { SHOP_DICT } from "@/i18n/shop";
import { routes } from "@/lib/routes";

export default async function CollectorNotFound() {
  const t = SHOP_DICT[await getLocale()];
  return (
    <EmptyState
      title={t.notFound.collectorTitle}
      action={
        <LinkButton href={routes.collector.today} size="lg">
          {t.notFound.collectorHome}
        </LinkButton>
      }
    >
      {t.notFound.collectorBody}
    </EmptyState>
  );
}

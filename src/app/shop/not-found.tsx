import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { routes } from "@/lib/routes";

export default function ShopNotFound() {
  return (
    <EmptyState
      title="Buyurtma topilmadi"
      action={
        <LinkButton href={routes.shop.home} size="lg">
          Bosh sahifaga
        </LinkButton>
      }
    >
      Bu buyurtma yo‘q yoki boshqa do‘konga tegishli.
    </EmptyState>
  );
}

import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { routes } from "@/lib/routes";

export default function CollectorNotFound() {
  return (
    <EmptyState
      title="Topilmadi"
      action={
        <LinkButton href={routes.collector.today} size="lg">
          Bugungi reys
        </LinkButton>
      }
    >
      Bu reys yoki nuqta yo‘q yoki boshqa yig‘uvchiga biriktirilgan.
    </EmptyState>
  );
}

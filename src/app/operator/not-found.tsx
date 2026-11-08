import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { routes } from "@/lib/routes";

export default function OperatorNotFound() {
  return (
    <EmptyState
      title="Topilmadi"
      action={
        <>
          <LinkButton href={routes.operator.trips}>Reyslar</LinkButton>
          <LinkButton href={routes.operator.queue} variant="secondary">
            Navbat
          </LinkButton>
        </>
      }
    >
      Bunday reys yoki yozuv yo‘q. Havolani tekshiring.
    </EmptyState>
  );
}

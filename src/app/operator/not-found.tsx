import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { getLocale } from "@/i18n/server";
import { OPERATOR_DICT } from "@/i18n/operator";
import { routes } from "@/lib/routes";

export default async function OperatorNotFound() {
  const d = OPERATOR_DICT[await getLocale()];
  return (
    <EmptyState
      title={d.notFound.title}
      action={
        <>
          <LinkButton href={routes.operator.trips}>{d.common.trips}</LinkButton>
          <LinkButton href={routes.operator.queue} variant="secondary">
            {d.common.queue}
          </LinkButton>
        </>
      }
    >
      {d.notFound.text}
    </EmptyState>
  );
}

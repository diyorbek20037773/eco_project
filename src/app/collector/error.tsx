"use client";

import { ErrorState } from "@/components/ui/ErrorState";
import { routes } from "@/lib/routes";

export default function CollectorError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} homeHref={routes.collector.today} />;
}

"use client";

import { PageSkeleton } from "@/components/ui/States";
import { useDict } from "@/i18n/LocaleProvider";
import { OPERATOR_DICT } from "@/i18n/operator";

export default function Loading() {
  const d = useDict(OPERATOR_DICT);
  return <PageSkeleton rows={6} label={d.notFound.loadingTrip} />;
}

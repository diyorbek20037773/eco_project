import { PageSkeleton } from "@/components/ui/States";
import { UiText } from "@/components/ui/UiText";

export default function Loading() {
  return <PageSkeleton rows={2} label={<UiText k="loadingTrip" />} />;
}

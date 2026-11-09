import type { Metadata } from "next";
import type { TripBuilderOptions } from "@/server/contract";
import { getTripBuilderOptions } from "@/server/queries/operator";
import { tashkentToday } from "@/domain/time";
import { defaultTripWindow } from "@/components/operator/trip-defaults";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { OPERATOR_DICT } from "@/i18n/operator";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { IconChevronLeft } from "@/components/ui/icons";
import { TripBuilder } from "@/components/operator/TripBuilder";

export async function generateMetadata(): Promise<Metadata> {
  return { title: OPERATOR_DICT[await getLocale()].newTrip.metaTitle };
}

export default async function NewTripPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = OPERATOR_DICT[await getLocale()];
  const t = d.newTrip;
  const raw = Array.isArray(sp.ids) ? sp.ids.join(",") : (sp.ids ?? "");
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const back = (
    <TextLink href={routes.operator.queue}>
      <IconChevronLeft size={18} /> {d.common.queue}
    </TextLink>
  );

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title={t.noneTitle} action={<LinkButton href={routes.operator.queue}>{d.common.toQueue}</LinkButton>}>
          {t.noneText}
        </EmptyState>
      </div>
    );
  }

  const options: TripBuilderOptions = await getTripBuilderOptions(ids);
  const today = tashkentToday();

  if (options.selected.length === 0) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title={t.goneTitle} action={<LinkButton href={routes.operator.queue}>{t.refreshQueue}</LinkButton>}>
          {t.goneText}
        </EmptyState>
      </div>
    );
  }

  // Standart vaqt: tanlangan buyurtmalarning eng erta tayyor vaqti va eng kech tugashi (Toshkent).
  const { date, fromTime, toTime } = defaultTripWindow(options.selected, today);
  const missing = ids.length - options.selected.length;

  return (
    <div className="space-y-4">
      {back}
      <PageTitle sub={t.sub}>{t.title}</PageTitle>
      {missing > 0 ? (
        <p className="rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-sm font-semibold text-amber">
          {fmt(t.missing, { n: missing })}
        </p>
      ) : null}
      <TripBuilder options={options} defaults={{ date, fromTime, toTime, today }} />
    </div>
  );
}

import type { Metadata } from "next";
import type { TripBuilderOptions } from "@/server/contract";
import { getTripBuilderOptions } from "@/server/queries/operator";
import { tashkentToday } from "@/domain/time";
import { defaultTripWindow } from "@/components/operator/trip-defaults";
import { routes } from "@/lib/routes";
import { PageTitle } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { IconChevronLeft } from "@/components/ui/icons";
import { TripBuilder } from "@/components/operator/TripBuilder";

export const metadata: Metadata = { title: "Reys tuzish" };

export default async function NewTripPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.ids) ? sp.ids.join(",") : (sp.ids ?? "");
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const back = (
    <TextLink href={routes.operator.queue}>
      <IconChevronLeft size={18} /> Navbat
    </TextLink>
  );

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title="Buyurtma tanlanmagan" action={<LinkButton href={routes.operator.queue}>Navbatga o‘tish</LinkButton>}>
          Reys tuzish uchun navbatdan bir yoki bir nechta buyurtmani belgilang.
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
        <EmptyState title="Tanlangan buyurtmalar navbatda yo‘q" action={<LinkButton href={routes.operator.queue}>Navbatni yangilash</LinkButton>}>
          Ular boshqa reysga kiritilgan yoki bekor qilingan bo‘lishi mumkin.
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
      <PageTitle sub="Tartib, yig‘uvchi, xaridor, vaqt va narxlarni belgilang.">Reys tuzish</PageTitle>
      {missing > 0 ? (
        <p className="rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-sm font-semibold text-amber">
          ◷ {missing} ta tanlangan buyurtma endi navbatda emas — ro‘yxatdan chiqarildi.
        </p>
      ) : null}
      <TripBuilder options={options} defaults={{ date, fromTime, toTime, today }} />
    </div>
  );
}

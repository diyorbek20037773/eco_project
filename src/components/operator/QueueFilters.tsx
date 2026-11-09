"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { inputClasses } from "@/components/ui/styles";
import { cx } from "@/components/ui/cx";
import type { Dict } from "@/i18n/dictionaries";

/** Navbat filtri: tezkor sana, aniq sana va hudud. O‘zgarishi bilan darhol qo‘llanadi (GET — havola ulashiladi). */
export function QueueFilters({
  date,
  district,
  districts,
  today,
  tomorrow,
  t,
}: {
  date?: string;
  district?: string;
  districts: string[];
  today: string;
  tomorrow: string;
  t: Dict["queue"];
}) {
  const router = useRouter();
  const href = (d?: string, dist?: string) => {
    const p = new URLSearchParams();
    if (d) p.set("date", d);
    if (dist) p.set("district", dist);
    const s = p.toString();
    return s ? `${routes.operator.queue}?${s}` : routes.operator.queue;
  };
  const chip = (active: boolean) =>
    cx(
      "inline-flex min-h-12 items-center rounded-full border px-5 text-base font-semibold",
      active ? "border-mint bg-mint text-ink" : "border-line-strong bg-surface hover:bg-mint-soft",
    );

  return (
    <form
      method="get"
      action={routes.operator.queue}
      className="flex flex-wrap items-end gap-4 rounded-2xl border border-line bg-surface p-4"
      aria-label={t.filterLabel}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        router.push(href(String(fd.get("date") || "") || undefined, String(fd.get("district") || "") || undefined));
      }}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.quickDate}>
        <Link href={href(undefined, district)} className={chip(!date)} aria-current={!date ? "true" : undefined}>
          {t.all}
        </Link>
        <Link href={href(today, district)} className={chip(date === today)} aria-current={date === today ? "true" : undefined}>
          {t.today}
        </Link>
        <Link href={href(tomorrow, district)} className={chip(date === tomorrow)} aria-current={date === tomorrow ? "true" : undefined}>
          {t.tomorrow}
        </Link>
      </div>
      <span aria-hidden="true" className="hidden h-10 w-px self-center bg-line sm:block" />
      <div className="min-w-0">
        <label htmlFor="q-date" className="mb-1 block font-semibold">
          {t.date}
        </label>
        <input
          id="q-date"
          name="date"
          type="date"
          defaultValue={date ?? ""}
          className={cx(inputClasses(), "w-48")}
          onChange={(e) => router.push(href(e.target.value || undefined, district))}
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="q-district" className="mb-1 block font-semibold">
          {t.district}
        </label>
        <select
          id="q-district"
          name="district"
          defaultValue={district ?? ""}
          className={cx(inputClasses(), "w-52 pr-8")}
          onChange={(e) => router.push(href(date, e.target.value || undefined))}
        >
          <option value="">{t.allDistricts}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}

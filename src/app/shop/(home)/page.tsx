import type { Metadata } from "next";
import type { ShopHome } from "@/server/contract";
import { getShopHome } from "@/server/queries/shop";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { labelsFor } from "@/i18n/labels";
import { SHOP_DICT } from "@/i18n/shop";
import { formatKgL, formatSomL, formatWindowL, telHref } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card, Section, StatRow } from "@/components/ui/Card";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { LateBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { IconClock, IconHistory, IconPhone, IconPlus } from "@/components/ui/icons";
import { ConfirmWeighing } from "@/components/shop/ConfirmWeighing";
import { DisputeAck } from "@/components/disputes/DisputeAck";
import { ReceiptCard } from "@/components/shop/Receipt";
import { RequestCard } from "@/components/shop/RequestCard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SHOP_DICT[await getLocale()].meta.shopHome };
}

/** Kechikish: vaqt oralig‘i o‘tib ketgan, lekin karton hali olinmagan. */
function isLate(r: ShopHome["activeRequests"][number], now: Date): boolean {
  if (r.status !== "NEW" && r.status !== "PLANNED" && r.status !== "SKIPPED") return false;
  const end = r.trip && r.status === "PLANNED" ? r.trip.windowEnd : r.readyTo;
  return end.getTime() < now.getTime();
}

export default async function ShopHomePage() {
  const now = new Date();
  const [home, locale]: [ShopHome, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getShopHome(), getLocale()]);
  const t = SHOP_DICT[locale];
  const h = t.home;
  const L = labelsFor(locale);
  const next = home.nextPickup;
  const others = home.activeRequests.filter((r) => r.id !== next?.id);

  return (
    <div className="space-y-6">
      {/* 1. Keyingi olib ketish */}
      <section aria-labelledby="next-title">
        <Card tone={next ? "primary" : "surface"} className="space-y-2">
          <h1 id="next-title" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <IconClock size={18} /> {h.nextTitle}
          </h1>
          {next ? (
            <>
              <p className="text-2xl font-bold leading-tight tabular-nums">
                {next.trip ? formatWindowL(next.trip.windowStart, next.trip.windowEnd, locale) : formatWindowL(next.readyFrom, next.readyTo, locale)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="request" value={next.status} />
                {isLate(next, now) ? <LateBadge /> : null}
                <span className="text-sm text-muted">
                  {fmt(t.c.orderNo, { n: next.number })} · {next.point.name}
                </span>
              </div>
              <p className="text-sm tabular-nums">
                {next.estimatedGrams !== null
                  ? fmt(t.c.approx, { kg: formatKgL(next.estimatedGrams, locale) })
                  : next.volume
                    ? L.volume[next.volume]
                    : null}
              </p>
              {next.trip ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="min-w-0 text-sm">
                    {t.c.collector} <span className="font-semibold">{next.trip.collectorName}</span>
                  </p>
                  {next.trip.collectorPhone ? (
                    <LinkButton href={telHref(next.trip.collectorPhone)} variant="secondary" size="sm" icon={<IconPhone size={18} />}>
                      {t.c.call}
                    </LinkButton>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">{h.planNote}</p>
              )}
              <TextLink href={routes.shop.request(next.id)}>{t.c.details}</TextLink>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">{h.noneTitle}</p>
              <p className="text-muted">{h.noneBody}</p>
            </>
          )}
        </Card>
      </section>

      {/* 2. Asosiy amal */}
      <LinkButton href={routes.shop.newRequest} size="xl" block icon={<IconPlus size={24} />}>
        {h.cta}
      </LinkButton>

      {/* 3. Tasdiq kutayotgan tortishlar */}
      {home.pendingConfirmations.length > 0 ? (
        <Section id="confirm" title={h.confirmTitle} description={h.confirmDesc}>
          <ul className="space-y-3">
            {home.pendingConfirmations.map((r) => (
              <li key={r.id}>
                <Card tone="warning" className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">
                      {fmt(t.c.orderNo, { n: r.number })} · {r.point.name}
                    </p>
                    <p className="text-2xl font-bold tabular-nums">{r.netGrams !== null ? formatKgL(r.netGrams, locale) : "—"}</p>
                  </div>
                  {r.stop ? (
                    <ConfirmWeighing stopId={r.stop.id} netGrams={r.netGrams} />
                  ) : (
                    <TextLink href={routes.shop.request(r.id)}>{h.openDetails}</TextLink>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Bahs qarorlari */}
      {home.disputesAwaitingAck.length > 0 ? (
        <Section id="disputes" title={h.disputesTitle} description={h.disputesDesc}>
          <ul className="space-y-3">
            {home.disputesAwaitingAck.map((d) => (
              <li key={d.id}>
                <DisputeAck dispute={d} context={`${fmt(t.c.orderNo, { n: d.requestNumber })} · ${d.pointName}`} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 4. Oxirgi kvitansiya */}
      <Section id="receipt" title={h.receiptSection}>
        {home.lastReceipt ? (
          <ReceiptCard receipt={home.lastReceipt} title={h.receiptTitle} />
        ) : (
          <EmptyState title={h.noReceiptTitle}>{h.noReceiptBody}</EmptyState>
        )}
        <StatRow
          items={[
            { label: h.totalAccrued, value: formatSomL(home.totals.accrued, locale) },
            { label: h.totalPaid, value: formatSomL(home.totals.paid, locale) },
            { label: h.totalRemaining, value: formatSomL(home.totals.remaining, locale) },
          ]}
        />
      </Section>

      {/* Faol buyurtmalar */}
      <Section id="active" title={h.activeTitle}>
        {others.length > 0 ? (
          <ul className="space-y-2">
            {others.map((r) => (
              <li key={r.id}>
                <RequestCard r={r} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{h.noOtherActive}</p>
        )}
      </Section>

      {home.points.length > 0 ? (
        <Section id="points" title={h.pointsTitle}>
          <ul className="space-y-2">
            {home.points.map((p) => (
              <li key={p.id}>
                <Card className="py-3">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted">
                    {p.address} · {p.district}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <LinkButton href={routes.shop.history} variant="secondary" block icon={<IconHistory />}>
        {h.historyLink}
      </LinkButton>
    </div>
  );
}

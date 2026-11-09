import type { Metadata } from "next";
import type { OperatorDirectory } from "@/server/contract";
import { getDirectory } from "@/server/queries/operator";
import { uzText } from "@/domain/labels";
import { fmt } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { OPERATOR_DICT } from "@/i18n/operator";
import { formatDateL, formatKgL, formatSomL } from "@/lib/format";
import { Card, PageTitle, Section } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/States";
import { Badge } from "@/components/ui/StatusBadge";
import {
  AddPointForm,
  AddShopUserForm,
  CreateBuyerForm,
  CreateCollectorForm,
  CreateShopForm,
  CreateTariffForm,
  UpdateBuyerForm,
} from "@/components/operator/DirectoryForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: OPERATOR_DICT[await getLocale()].directory.metaTitle };
}

export default async function DirectoryPage() {
  const [dir, locale]: [OperatorDirectory, Awaited<ReturnType<typeof getLocale>>] = await Promise.all([getDirectory(), getLocale()]);
  const t = OPERATOR_DICT[locale].directory;
  const formatKg = (g: number) => formatKgL(g, locale);
  const formatSom = (n: number) => formatSomL(n, locale);
  const currentTariff = dir.tariffs[0] ?? null;

  return (
    <div className="space-y-8">
      <PageTitle sub={t.sub}>{t.title}</PageTitle>

      <nav aria-label={t.navLabel} className="flex flex-wrap gap-2">
        {[
          ["#shops", fmt(t.navShops, { n: dir.shops.length })],
          ["#collectors", fmt(t.navCollectors, { n: dir.collectors.length })],
          ["#buyers", fmt(t.navBuyers, { n: dir.buyers.length })],
          ["#tariffs", t.navTariffs],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-primary-soft">
            {label}
          </a>
        ))}
      </nav>

      <Section id="shops" title={t.shopsTitle}>
        <Disclosure summary={t.addShop}>
          <CreateShopForm districts={dir.districts} />
        </Disclosure>
        {dir.shops.length === 0 ? (
          <EmptyState title={t.noShopsTitle}>{t.noShopsText}</EmptyState>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {dir.shops.map((shop) => (
              <li key={shop.id}>
                <Card className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold">{shop.name}</h3>
                    <p className="text-sm text-muted">{[shop.contactName, shop.phone].filter(Boolean).join(" · ") || t.noContact}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.points}</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {shop.points.map((p) => (
                        <li key={p.id} className="rounded-lg bg-canvas p-2">
                          <span className="font-semibold">{p.name}</span> · {p.district}
                          <span className="block text-muted">
                            {p.address}
                            {p.landmark ? fmt(t.landmark, { l: p.landmark }) : ""} · {p.contactName ? `${p.contactName}, ` : ""}
                            {p.contactPhone}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.staff}</p>
                    {shop.users.length === 0 ? (
                      <p className="text-sm text-amber">{t.noAccount}</p>
                    ) : (
                      <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                        {shop.users.map((u) => (
                          <li key={u.id} className="rounded-full bg-kraft px-3 py-1">
                            {u.name} · <span className="font-mono">{u.login}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Disclosure summary={t.addPoint}>
                    <AddPointForm shopId={shop.id} districts={dir.districts} />
                  </Disclosure>
                  <Disclosure summary={t.addUser}>
                    <AddShopUserForm shopId={shop.id} />
                  </Disclosure>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="collectors" title={t.collectorsTitle} description={t.collectorsDesc}>
        <Disclosure summary={t.addCollector}>
          <CreateCollectorForm />
        </Disclosure>
        {dir.collectors.length === 0 ? (
          <EmptyState title={t.noCollectorsTitle}>{t.noCollectorsText}</EmptyState>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dir.collectors.map((c) => (
              <li key={c.id}>
                <Card className="py-3">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.phone ?? t.noPhone} · <span className="font-mono">{c.login}</span>
                  </p>
                  <p className="text-sm tabular-nums">{fmt(t.activeTrips, { n: c.activeTrips })}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="buyers" title={t.buyersTitle} description={t.buyersDesc}>
        <Disclosure summary={t.addBuyer}>
          <CreateBuyerForm />
        </Disclosure>
        {dir.buyers.length === 0 ? (
          <EmptyState title={t.noBuyersTitle}>{t.noBuyersText}</EmptyState>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {dir.buyers.map((b) => (
              <li key={b.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold">{b.name}</h3>
                    {b.isActive ? <Badge tone="success">{t.active}</Badge> : <Badge tone="muted">{t.inactive}</Badge>}
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">{t.qualityTerms}</span> {uzText(b.qualityTerms)}
                  </p>
                  <p className="text-sm tabular-nums">
                    <span className="font-semibold">{t.minBatch}</span> {formatKg(b.minBatchGrams)}
                  </p>
                  <p className="text-sm text-muted">{[b.contactName, b.phone, b.address].filter(Boolean).join(" · ") || t.noContact}</p>
                  <Disclosure summary={t.edit}>
                    <UpdateBuyerForm buyer={b} />
                  </Disclosure>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="tariffs" title={t.tariffsTitle} description={t.tariffsDesc}>
        <Card className="space-y-3">
          <h3 className="font-bold">{t.newTariff}</h3>
          <CreateTariffForm current={currentTariff} />
        </Card>
        {dir.tariffs.length === 0 ? (
          <p className="text-muted">{t.noTariffs}</p>
        ) : (
          <ul className="space-y-2">
            {dir.tariffs.map((tf, i) => (
              <li key={tf.id}>
                <Card tone={i === 0 ? "primary" : "surface"} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <span className="font-semibold tabular-nums">
                    {fmt(t.tariffLine, { shop: formatSom(tf.shopPricePerKg), buyer: formatSom(tf.buyerPricePerKg), fee: formatSom(tf.serviceFee) })}
                  </span>
                  <span className="text-sm text-muted">
                    {i === 0 ? t.current : ""}
                    {fmt(t.validFrom, { date: formatDateL(tf.validFrom, locale) })}
                    {tf.note ? ` · ${uzText(tf.note)}` : ""}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

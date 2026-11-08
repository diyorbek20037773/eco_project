import type { Metadata } from "next";
import type { OperatorDirectory } from "@/server/contract";
import { getDirectory } from "@/server/queries/operator";
import { uzText } from "@/domain/labels";
import { formatDate, formatKg, formatSom } from "@/lib/format";
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

export const metadata: Metadata = { title: "Katalog" };

export default async function DirectoryPage() {
  const dir: OperatorDirectory = await getDirectory();
  const currentTariff = dir.tariffs[0] ?? null;

  return (
    <div className="space-y-8">
      <PageTitle sub="Do‘konlar va nuqtalar, yig‘uvchilar, xaridorlar va tariflar">Katalog</PageTitle>

      <nav aria-label="Katalog bo‘limlari" className="flex flex-wrap gap-2">
        {[
          ["#shops", `Do‘konlar (${dir.shops.length})`],
          ["#collectors", `Yig‘uvchilar (${dir.collectors.length})`],
          ["#buyers", `Xaridorlar (${dir.buyers.length})`],
          ["#tariffs", "Tariflar"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-primary-soft">
            {label}
          </a>
        ))}
      </nav>

      <Section id="shops" title="Do‘konlar va nuqtalar">
        <Disclosure summary="+ Yangi do‘kon qo‘shish">
          <CreateShopForm districts={dir.districts} />
        </Disclosure>
        {dir.shops.length === 0 ? (
          <EmptyState title="Hali do‘kon yo‘q">Yuqoridagi forma orqali birinchi do‘konni qo‘shing.</EmptyState>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {dir.shops.map((shop) => (
              <li key={shop.id}>
                <Card className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold">{shop.name}</h3>
                    <p className="text-sm text-muted">{[shop.contactName, shop.phone].filter(Boolean).join(" · ") || "Kontakt ko‘rsatilmagan"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Nuqtalar</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {shop.points.map((p) => (
                        <li key={p.id} className="rounded-lg bg-canvas p-2">
                          <span className="font-semibold">{p.name}</span> · {p.district}
                          <span className="block text-muted">
                            {p.address}
                            {p.landmark ? ` (mo‘ljal: ${p.landmark})` : ""} · {p.contactName ? `${p.contactName}, ` : ""}
                            {p.contactPhone}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Xodimlar</p>
                    {shop.users.length === 0 ? (
                      <p className="text-sm text-amber">◷ Akkaunt yo‘q — do‘kon tizimga kira olmaydi.</p>
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
                  <Disclosure summary="+ Nuqta qo‘shish">
                    <AddPointForm shopId={shop.id} districts={dir.districts} />
                  </Disclosure>
                  <Disclosure summary="+ Xodim akkaunti qo‘shish">
                    <AddShopUserForm shopId={shop.id} />
                  </Disclosure>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="collectors" title="Yig‘uvchilar" description="Material hamkor yig‘uvchiga tegishli.">
        <Disclosure summary="+ Yangi yig‘uvchi qo‘shish">
          <CreateCollectorForm />
        </Disclosure>
        {dir.collectors.length === 0 ? (
          <EmptyState title="Hali yig‘uvchi yo‘q">Reys tuzish uchun kamida bitta yig‘uvchi kerak.</EmptyState>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dir.collectors.map((c) => (
              <li key={c.id}>
                <Card className="py-3">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.phone ?? "Telefon yo‘q"} · <span className="font-mono">{c.login}</span>
                  </p>
                  <p className="text-sm tabular-nums">Faol reys: {c.activeTrips}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="buyers" title="Xaridorlar" description="Sifat sharti va minimal partiya reys tuzishda ko‘rsatiladi.">
        <Disclosure summary="+ Yangi xaridor qo‘shish">
          <CreateBuyerForm />
        </Disclosure>
        {dir.buyers.length === 0 ? (
          <EmptyState title="Hali xaridor yo‘q">Reys tuzish uchun kamida bitta xaridor kerak.</EmptyState>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {dir.buyers.map((b) => (
              <li key={b.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold">{b.name}</h3>
                    {b.isActive ? <Badge tone="success">Faol</Badge> : <Badge tone="muted">Faol emas</Badge>}
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">Sifat sharti:</span> {uzText(b.qualityTerms)}
                  </p>
                  <p className="text-sm tabular-nums">
                    <span className="font-semibold">Minimal partiya:</span> {formatKg(b.minBatchGrams)}
                  </p>
                  <p className="text-sm text-muted">{[b.contactName, b.phone, b.address].filter(Boolean).join(" · ") || "Kontakt ko‘rsatilmagan"}</p>
                  <Disclosure summary="Tahrirlash">
                    <UpdateBuyerForm buyer={b} />
                  </Disclosure>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="tariffs" title="Tariflar" description="Yangi tarif faqat keyingi reyslarga qo‘llanadi; mavjud reyslar narx nusxasini saqlaydi.">
        <Card className="space-y-3">
          <h3 className="font-bold">Yangi tarif</h3>
          <CreateTariffForm current={currentTariff} />
        </Card>
        {dir.tariffs.length === 0 ? (
          <p className="text-muted">Tarif yo‘q — reys tuzishda narxlar qo‘lda kiritiladi.</p>
        ) : (
          <ul className="space-y-2">
            {dir.tariffs.map((t, i) => (
              <li key={t.id}>
                <Card tone={i === 0 ? "primary" : "surface"} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <span className="font-semibold tabular-nums">
                    Do‘konga {formatSom(t.shopPricePerKg)}/kg · xaridor {formatSom(t.buyerPricePerKg)}/kg · xizmat {formatSom(t.serviceFee)}
                  </span>
                  <span className="text-sm text-muted">
                    {i === 0 ? "Joriy · " : ""}
                    {formatDate(t.validFrom)} dan{t.note ? ` · ${uzText(t.note)}` : ""}
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

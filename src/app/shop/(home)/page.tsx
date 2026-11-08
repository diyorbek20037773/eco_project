import type { Metadata } from "next";
import type { ShopHome } from "@/server/contract";
import { getShopHome } from "@/server/queries/shop";
import { VOLUME_LABEL } from "@/domain/labels";
import { formatKg, formatSom, formatWindow, telHref } from "@/lib/format";
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

export const metadata: Metadata = { title: "Do‘kon" };

/** Kechikish: vaqt oralig‘i o‘tib ketgan, lekin karton hali olinmagan. */
function isLate(r: ShopHome["activeRequests"][number], now: Date): boolean {
  if (r.status !== "NEW" && r.status !== "PLANNED" && r.status !== "SKIPPED") return false;
  const end = r.trip && r.status === "PLANNED" ? r.trip.windowEnd : r.readyTo;
  return end.getTime() < now.getTime();
}

export default async function ShopHomePage() {
  const now = new Date();
  const home: ShopHome = await getShopHome();
  const next = home.nextPickup;
  const others = home.activeRequests.filter((r) => r.id !== next?.id);

  return (
    <div className="space-y-6">
      {/* 1. Keyingi olib ketish */}
      <section aria-labelledby="next-title">
        <Card tone={next ? "primary" : "surface"} className="space-y-2">
          <h1 id="next-title" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <IconClock size={18} /> Keyingi olib ketish
          </h1>
          {next ? (
            <>
              <p className="text-2xl font-bold leading-tight tabular-nums">
                {next.trip ? formatWindow(next.trip.windowStart, next.trip.windowEnd) : formatWindow(next.readyFrom, next.readyTo)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="request" value={next.status} />
                {isLate(next, now) ? <LateBadge /> : null}
                <span className="text-sm text-muted">
                  Buyurtma №{next.number} · {next.point.name}
                </span>
              </div>
              <p className="text-sm tabular-nums">
                {next.estimatedGrams !== null
                  ? `Taxminan ${formatKg(next.estimatedGrams)}`
                  : next.volume
                    ? VOLUME_LABEL[next.volume]
                    : null}
              </p>
              {next.trip ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="min-w-0 text-sm">
                    Yig‘uvchi: <span className="font-semibold">{next.trip.collectorName}</span>
                  </p>
                  {next.trip.collectorPhone ? (
                    <LinkButton href={telHref(next.trip.collectorPhone)} variant="secondary" size="sm" icon={<IconPhone size={18} />}>
                      Qo‘ng‘iroq qilish
                    </LinkButton>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">Operator reysni rejalashtirgach, aniq vaqt shu yerda chiqadi.</p>
              )}
              <TextLink href={routes.shop.request(next.id)}>Tafsilotlar</TextLink>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">Rejalashtirilgan olib ketish yo‘q</p>
              <p className="text-muted">Karton yig‘ilgan bo‘lsa, «Olib keting» tugmasini bosing — operator reysga qo‘shadi.</p>
            </>
          )}
        </Card>
      </section>

      {/* 2. Asosiy amal */}
      <LinkButton href={routes.shop.newRequest} size="xl" block icon={<IconPlus size={24} />}>
        Olib keting
      </LinkButton>

      {/* 3. Tasdiq kutayotgan tortishlar */}
      {home.pendingConfirmations.length > 0 ? (
        <Section id="confirm" title="Vaznni tasdiqlang" description="Yig‘uvchi tortdi. Vazn to‘g‘ri bo‘lsa tasdiqlang, bo‘lmasa sabab bilan e’tiroz bildiring.">
          <ul className="space-y-3">
            {home.pendingConfirmations.map((r) => (
              <li key={r.id}>
                <Card tone="warning" className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">
                      Buyurtma №{r.number} · {r.point.name}
                    </p>
                    <p className="text-2xl font-bold tabular-nums">{r.netGrams !== null ? formatKg(r.netGrams) : "—"}</p>
                  </div>
                  {r.stop ? (
                    <ConfirmWeighing stopId={r.stop.id} netGrams={r.netGrams} />
                  ) : (
                    <TextLink href={routes.shop.request(r.id)}>Tafsilotlarni ochish</TextLink>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Bahs qarorlari */}
      {home.disputesAwaitingAck.length > 0 ? (
        <Section id="disputes" title="Bahs qarorlari" description="Operator qaror chiqardi. Roziligingizni bildiring.">
          <ul className="space-y-3">
            {home.disputesAwaitingAck.map((d) => (
              <li key={d.id}>
                <DisputeAck dispute={d} context={`Buyurtma №${d.requestNumber} · ${d.pointName}`} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 4. Oxirgi kvitansiya */}
      <Section id="receipt" title="Oxirgi topshirish">
        {home.lastReceipt ? (
          <ReceiptCard receipt={home.lastReceipt} title="Kvitansiya" />
        ) : (
          <EmptyState title="Hali topshirish yo‘q">Birinchi olib ketishdan keyin vazn, narx va summa shu yerda ko‘rinadi.</EmptyState>
        )}
        <StatRow
          items={[
            { label: "Jami hisoblangan", value: formatSom(home.totals.accrued) },
            { label: "To‘langan", value: formatSom(home.totals.paid) },
            { label: "Qoldiq", value: formatSom(home.totals.remaining) },
          ]}
        />
      </Section>

      {/* Faol buyurtmalar */}
      <Section id="active" title="Faol buyurtmalar">
        {others.length > 0 ? (
          <ul className="space-y-2">
            {others.map((r) => (
              <li key={r.id}>
                <RequestCard r={r} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Boshqa faol buyurtma yo‘q.</p>
        )}
      </Section>

      {home.points.length > 0 ? (
        <Section id="points" title="Saqlangan nuqtalar">
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
        Tarix va barcha kvitansiyalar
      </LinkButton>
    </div>
  );
}

import type { SettlementDTO } from "@/server/contract";
import { fmt, type Locale } from "@/i18n/config";
import { OPERATOR_DICT } from "@/i18n/operator";
import { formatKgL, formatSomL } from "@/lib/format";
import { Card, KeyValues } from "@/components/ui/Card";

/**
 * Vaznlar guruhi: topshirishlar yig‘indisi ↔ qabul vazni ↔ tafovut yonma-yon.
 * `locale` berilmasa — o‘zbekcha (yig‘uvchi sahifasi ham shu komponentlardan foydalanadi).
 */
export function WeightsCompare({
  deliveredGrams,
  acceptedGrams,
  locale = "uz",
}: {
  deliveredGrams: number;
  acceptedGrams: number | null;
  locale?: Locale;
}) {
  const t = OPERATOR_DICT[locale].settlement;
  const formatKg = (g: number) => formatKgL(g, locale);
  const diff = acceptedGrams === null ? null : acceptedGrams - deliveredGrams;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Card className="p-3">
        <dt className="text-sm text-muted">{t.delivered}</dt>
        <dd className="text-2xl font-bold tabular-nums">{formatKg(deliveredGrams)}</dd>
        <dd className="text-xs text-muted">{t.deliveredSub}</dd>
      </Card>
      <Card className="p-3">
        <dt className="text-sm text-muted">{t.accepted}</dt>
        <dd className="text-2xl font-bold tabular-nums">{acceptedGrams === null ? "—" : formatKg(acceptedGrams)}</dd>
        <dd className="text-xs text-muted">{acceptedGrams === null ? t.acceptedNone : t.acceptedSub}</dd>
      </Card>
      <Card tone={diff ? "warning" : "surface"} className="p-3">
        <dt className="text-sm text-muted">{t.diff}</dt>
        <dd className="text-2xl font-bold tabular-nums">{diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatKg(diff)}`}</dd>
        <dd className="text-xs text-muted">{diff ? t.diffSub : diff === 0 ? t.diffZero : t.diffPending}</dd>
      </Card>
    </dl>
  );
}

/**
 * Reys iqtisodi (hisoblangan). Eco Point xizmat haqi reys daromadiga qayta qo‘shilmaydi:
 * u hamkor hissasidan ayriladi va alohida «Eco Point xizmat daromadi» sifatida ko‘rsatiladi.
 */
export function SettlementView({ s, showShops = true, locale = "uz" }: { s: SettlementDTO; showShops?: boolean; locale?: Locale }) {
  const t = OPERATOR_DICT[locale].settlement;
  const formatKg = (g: number) => formatKgL(g, locale);
  const formatSom = (n: number) => formatSomL(n, locale);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="space-y-1">
        <h3 className="font-bold">{t.economy}</h3>
        <KeyValues
          rows={[
            {
              label: fmt(t.buyerRevenue, { kg: formatKg(s.acceptedGrams), price: formatSom(s.buyerPricePerKg) }),
              value: formatSom(s.buyerRevenue),
            },
            { label: fmt(t.shops, { price: formatSom(s.shopPricePerKg) }), value: `− ${formatSom(s.shopPayoutTotal)}` },
            { label: t.expenses, value: `− ${formatSom(s.expensesTotal)}` },
            { label: t.contribution, value: formatSom(s.tripContribution), strong: true },
            { label: t.fee, value: `− ${formatSom(s.serviceFee)}` },
            { label: t.partner, value: formatSom(s.partnerShareAfterFee), strong: true },
          ]}
        />
      </Card>
      <div className="space-y-3">
        <Card tone="kraft" className="space-y-1">
          <h3 className="font-bold">{t.income}</h3>
          <p className="text-2xl font-bold tabular-nums">{formatSom(s.ecoPointServiceIncome)}</p>
          <p className="text-sm text-ink/80">{t.incomeNote}</p>
        </Card>
        {showShops && s.shopPayouts.length > 0 ? (
          <Card className="space-y-1">
            <h3 className="font-bold">{t.shopPayouts}</h3>
            <KeyValues rows={s.shopPayouts.map((p) => ({ label: `${p.shopName} · ${formatKg(p.netGrams)}`, value: formatSom(p.amount) }))} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

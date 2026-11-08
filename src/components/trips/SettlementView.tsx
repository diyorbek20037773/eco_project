import type { SettlementDTO } from "@/server/contract";
import { formatKg, formatSom } from "@/lib/format";
import { Card, KeyValues } from "@/components/ui/Card";

/** Vaznlar guruhi: topshirishlar yig‘indisi ↔ qabul vazni ↔ tafovut yonma-yon. */
export function WeightsCompare({ deliveredGrams, acceptedGrams }: { deliveredGrams: number; acceptedGrams: number | null }) {
  const diff = acceptedGrams === null ? null : acceptedGrams - deliveredGrams;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Card className="p-3">
        <dt className="text-sm text-muted">Topshirishlar yig‘indisi</dt>
        <dd className="text-2xl font-bold tabular-nums">{formatKg(deliveredGrams)}</dd>
        <dd className="text-xs text-muted">bekatlardagi amaldagi sof vazn</dd>
      </Card>
      <Card className="p-3">
        <dt className="text-sm text-muted">Xaridor qabul vazni</dt>
        <dd className="text-2xl font-bold tabular-nums">{acceptedGrams === null ? "—" : formatKg(acceptedGrams)}</dd>
        <dd className="text-xs text-muted">{acceptedGrams === null ? "qabul hali kiritilmagan" : "xaridor tasdig‘i bo‘yicha"}</dd>
      </Card>
      <Card tone={diff ? "warning" : "surface"} className="p-3">
        <dt className="text-sm text-muted">Tafovut</dt>
        <dd className="text-2xl font-bold tabular-nums">{diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatKg(diff)}`}</dd>
        <dd className="text-xs text-muted">{diff ? "do‘konlarga avtomatik yozilmaydi" : diff === 0 ? "tafovut yo‘q" : "qabuldan keyin"}</dd>
      </Card>
    </dl>
  );
}

/**
 * Reys iqtisodi (hisoblangan). Eco Point xizmat haqi reys daromadiga qayta qo‘shilmaydi:
 * u hamkor hissasidan ayriladi va alohida «Eco Point xizmat daromadi» sifatida ko‘rsatiladi.
 */
export function SettlementView({ s, showShops = true }: { s: SettlementDTO; showShops?: boolean }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="space-y-1">
        <h3 className="font-bold">Reys iqtisodi (hisoblangan)</h3>
        <KeyValues
          rows={[
            {
              label: `Xaridor to‘lovi (${formatKg(s.acceptedGrams)} × ${formatSom(s.buyerPricePerKg)}/kg)`,
              value: formatSom(s.buyerRevenue),
            },
            { label: `Do‘konlarga (${formatSom(s.shopPricePerKg)}/kg)`, value: `− ${formatSom(s.shopPayoutTotal)}` },
            { label: "Xarajatlar (transport, yuklash, boshqa)", value: `− ${formatSom(s.expensesTotal)}` },
            { label: "Butun reys hissasi", value: formatSom(s.tripContribution), strong: true },
            { label: "Eco Point xizmat haqi (hamkor to‘laydi)", value: `− ${formatSom(s.serviceFee)}` },
            { label: "Hamkorda qoladi", value: formatSom(s.partnerShareAfterFee), strong: true },
          ]}
        />
      </Card>
      <div className="space-y-3">
        <Card tone="kraft" className="space-y-1">
          <h3 className="font-bold">Eco Point xizmat daromadi</h3>
          <p className="text-2xl font-bold tabular-nums">{formatSom(s.ecoPointServiceIncome)}</p>
          <p className="text-sm text-ink/80">Reys hissasiga ikkinchi marta qo‘shilmaydi — hamkor hissasidan to‘lanadi.</p>
        </Card>
        {showShops && s.shopPayouts.length > 0 ? (
          <Card className="space-y-1">
            <h3 className="font-bold">Do‘konlar haqqi</h3>
            <KeyValues rows={s.shopPayouts.map((p) => ({ label: `${p.shopName} · ${formatKg(p.netGrams)}`, value: formatSom(p.amount) }))} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import type { ShopReceipt } from "@/server/contract";
import { formatKgL, formatSomL } from "@/lib/format";
import { fmt } from "@/i18n/config";
import { formatDateTimeL } from "@/i18n/common";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
import { Card, KeyValues } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";

/** Kvitansiya (karton rangidagi sirt): vazn, narx, summa, to‘langan, qoldiq, to‘lov holati. */
export function ReceiptCard({ receipt, title }: { receipt: ShopReceipt; title?: string }) {
  const locale = useLocale();
  const t = useDict(SHOP_DICT).receipt;
  const overpaid = receipt.remaining < 0;
  return (
    <Card tone="kraft" as="article" className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/80">{title ?? t.title}</p>
          <p className="text-lg font-bold">
            {fmt(t.line, { n: receipt.requestNumber, trip: receipt.tripNumber })}
          </p>
          <p className="text-sm text-ink/80">
            {receipt.pointName}
            {receipt.collectedAt ? ` · ${formatDateTimeL(receipt.collectedAt, locale)}` : ""}
          </p>
        </div>
        <StatusBadge kind="pay" value={receipt.payState} />
      </div>
      <KeyValues
        className="divide-kraft-line/50"
        rows={[
          { label: t.net, value: formatKgL(receipt.netGrams, locale) },
          { label: t.price, value: fmt(SHOP_DICT[locale].c.pricePerKg, { price: formatSomL(receipt.pricePerKg, locale) }) },
          {
            label: receipt.amountIsFinal ? t.amountFinal : t.amountEst,
            value: formatSomL(receipt.amount, locale),
            strong: true,
          },
          { label: t.paid, value: formatSomL(receipt.paid, locale) },
          {
            label: overpaid ? t.overpaid : t.remaining,
            value: formatSomL(Math.abs(receipt.remaining), locale),
            strong: true,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {receipt.disputeStatus ? (
          <StatusBadge kind="dispute" value={receipt.disputeStatus} />
        ) : receipt.confirmation === "CONFIRMED" ? (
          <Badge tone="success" icon="✓">
            {t.confirmed}
          </Badge>
        ) : receipt.confirmation === null ? (
          <Badge tone="warning" icon="◷">
            {t.awaiting}
          </Badge>
        ) : null}
      </div>
      {!receipt.amountIsFinal ? (
        <p className="text-sm text-ink/80">{t.note}</p>
      ) : null}
    </Card>
  );
}

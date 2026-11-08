import type { ShopReceipt } from "@/server/contract";
import { formatDateTime, formatKg, formatSom } from "@/lib/format";
import { Card, KeyValues } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";

/** Kvitansiya (karton rangidagi sirt): vazn, narx, summa, to‘langan, qoldiq, to‘lov holati. */
export function ReceiptCard({ receipt, title }: { receipt: ShopReceipt; title?: string }) {
  const overpaid = receipt.remaining < 0;
  return (
    <Card tone="kraft" as="article" className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/80">{title ?? "Kvitansiya"}</p>
          <p className="text-lg font-bold">
            Buyurtma №{receipt.requestNumber} · Reys №{receipt.tripNumber}
          </p>
          <p className="text-sm text-ink/80">
            {receipt.pointName}
            {receipt.collectedAt ? ` · ${formatDateTime(receipt.collectedAt)}` : ""}
          </p>
        </div>
        <StatusBadge kind="pay" value={receipt.payState} />
      </div>
      <KeyValues
        className="divide-kraft-line/50"
        rows={[
          { label: "Sof vazn", value: formatKg(receipt.netGrams) },
          { label: "Narx", value: `${formatSom(receipt.pricePerKg)}/kg` },
          {
            label: receipt.amountIsFinal ? "Summa (hisoblangan)" : "Summa (taxminiy)",
            value: formatSom(receipt.amount),
            strong: true,
          },
          { label: "To‘langan", value: formatSom(receipt.paid) },
          {
            label: overpaid ? "Ortiqcha to‘langan" : "Qoldiq",
            value: formatSom(Math.abs(receipt.remaining)),
            strong: true,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {receipt.disputeStatus ? (
          <StatusBadge kind="dispute" value={receipt.disputeStatus} />
        ) : receipt.confirmation === "CONFIRMED" ? (
          <Badge tone="success" icon="✓">
            Vazn tasdiqlangan
          </Badge>
        ) : receipt.confirmation === null ? (
          <Badge tone="warning" icon="◷">
            Vazn tasdiqingizni kutmoqda
          </Badge>
        ) : null}
      </div>
      {!receipt.amountIsFinal ? (
        <p className="text-sm text-ink/80">Summa xaridor qabulidan keyin yakunlanadi. Pul tizimdan tashqarida o‘tkaziladi, bu yerda faqat tasdig‘i qayd etiladi.</p>
      ) : null}
    </Card>
  );
}

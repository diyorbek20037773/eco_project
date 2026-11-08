import Link from "next/link";
import type { AuditDTO } from "@/server/contract";
import { uzText } from "@/domain/labels";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";

const ENTITY_LABEL: Record<string, string> = {
  PickupRequest: "Buyurtma",
  Trip: "Reys",
  TripStop: "Bekat",
  Weighing: "Tortish",
  ShopConfirmation: "Do‘kon tasdig‘i",
  Dispute: "Bahs",
  BuyerAcceptance: "Xaridor qabuli",
  Expense: "Xarajat",
  Obligation: "Majburiyat",
  Payment: "To‘lov",
  Shop: "Do‘kon",
  Point: "Nuqta",
  User: "Foydalanuvchi",
  Buyer: "Xaridor",
  Tariff: "Tarif",
  Attachment: "Fayl",
};

const ACTION_LABEL: Record<string, string> = {
  REQUEST_CREATED: "Buyurtma yaratildi",
  REQUEST_CANCELLED: "Buyurtma bekor qilindi",
  TRIP_CREATED: "Reys tuzildi",
  TRIP_STOPS_REORDERED: "Bekatlar tartibi o‘zgardi",
  TRIP_CANCELLED: "Reys bekor qilindi",
  TRIP_STATUS: "Reys holati o‘zgardi",
  STOP_COLLECTED: "Karton olindi (tortildi)",
  STOP_SKIPPED: "Bekat qoldirildi",
  WEIGHT_CONFIRMED: "Do‘kon vaznni tasdiqladi",
  WEIGHT_DISPUTED: "Do‘kon e’tiroz bildirdi",
  DISPUTE_DECIDED: "Bahs bo‘yicha qaror",
  DISPUTE_ACKNOWLEDGED: "Qarorga rozilik",
  DISPUTE_REJECTED: "Qarorga norozilik",
  DISPUTE_RESOLVED: "Bahs hal qilindi",
  ACCEPTANCE_RECORDED: "Xaridor qabuli saqlandi",
  EXPENSE_ADDED: "Xarajat qo‘shildi",
  PAYMENT_RECORDED: "To‘lov qayd etildi",
  REFUND_RECORDED: "Qaytarish qayd etildi",
  CORRECTION: "Tuzatish",
  OBLIGATIONS_RECOMPUTED: "Majburiyatlar qayta hisoblandi",
  SHOP_CREATED: "Do‘kon qo‘shildi",
  POINT_CREATED: "Nuqta qo‘shildi",
  USER_CREATED: "Foydalanuvchi qo‘shildi",
  BUYER_CREATED: "Xaridor qo‘shildi",
  BUYER_UPDATED: "Xaridor yangilandi",
  TARIFF_CREATED: "Yangi tarif",
};

function json(v: unknown): string {
  if (v === null || v === undefined) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Audit hodisalari: kim, qachon, nima; tuzatishda avvalgi va yangi qiymat, sabab. */
export function AuditList({ items, showTrip = false, tripIds }: { items: AuditDTO[]; showTrip?: boolean; tripIds?: Map<number, string> }) {
  if (items.length === 0) return <p className="text-muted">Hali audit yozuvi yo‘q.</p>;
  return (
    <ol className="space-y-2">
      {items.map((a) => {
        const hasDiff = a.before !== null && a.before !== undefined;
        const tripId = a.tripNumber !== null ? tripIds?.get(a.tripNumber) : undefined;
        return (
          <li key={a.id} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 font-semibold">
                <span>{ACTION_LABEL[a.action] ?? a.action}</span>
                <span className="text-muted"> · {ENTITY_LABEL[a.entityType] ?? a.entityType}</span>
                {showTrip && a.tripNumber !== null ? (
                  tripId ? (
                    <Link href={routes.operator.trip(tripId)} className="ml-1 text-primary underline underline-offset-4">
                      Reys №{a.tripNumber}
                    </Link>
                  ) : (
                    <span className="text-muted"> · Reys №{a.tripNumber}</span>
                  )
                ) : null}
              </p>
              <p className="text-sm text-muted tabular-nums">
                {formatDateTime(a.at)} · {a.actorName ?? "Tizim"}
              </p>
            </div>
            {a.reason ? (
              <p className="mt-1 text-sm">
                <span className="font-semibold">Sabab:</span> {uzText(a.reason)}
              </p>
            ) : null}
            {hasDiff || (a.after !== null && a.after !== undefined) ? (
              <details className="mt-1">
                <summary className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                  {hasDiff ? "Avvalgi va yangi qiymat" : "Qiymat"}
                </summary>
                <div className="grid gap-2 sm:grid-cols-2">
                  {hasDiff ? (
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">Avval</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-2 text-xs">{json(a.before)}</pre>
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted">Keyin</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-2 text-xs">{json(a.after)}</pre>
                  </div>
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// Holat va enum yorliqlari — uch tilda. O‘zbekcha qiymatlar src/domain/labels.ts dan (yagona manba).
import type {
  AttachmentKind,
  DiscrepancyDecision,
  DisputeStatus,
  ExpenseType,
  ObligationType,
  Party,
  PayState,
  PaymentKind,
  Quality,
  RequestStatus,
  Role,
  StopStatus,
  TripStatus,
  VolumeSize,
} from "@/server/contract";
import {
  ATTACHMENT_KIND_LABEL,
  DISCREPANCY_DECISION_LABEL,
  DISPUTE_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  OBLIGATION_TYPE_LABEL,
  PARTY_LABEL,
  PAY_STATE_LABEL,
  PAYMENT_KIND_LABEL,
  QUALITY_LABEL,
  REQUEST_STATUS_LABEL,
  ROLE_LABEL,
  STOP_STATUS_LABEL,
  TRIP_STATUS_LABEL,
  VOLUME_LABEL,
} from "@/domain/labels";
import type { Locale } from "./config";

export interface EnumLabels {
  role: Record<Role, string>;
  requestStatus: Record<RequestStatus, string>;
  tripStatus: Record<TripStatus, string>;
  stopStatus: Record<StopStatus, string>;
  disputeStatus: Record<DisputeStatus, string>;
  payState: Record<PayState, string>;
  party: Record<Party, string>;
  quality: Record<Quality, string>;
  expenseType: Record<ExpenseType, string>;
  obligationType: Record<ObligationType, string>;
  paymentKind: Record<PaymentKind, string>;
  attachmentKind: Record<AttachmentKind, string>;
  volume: Record<VolumeSize, string>;
  discrepancyDecision: Record<DiscrepancyDecision, string>;
  late: string;
  dispute: string;
}

const uz: EnumLabels = {
  role: ROLE_LABEL,
  requestStatus: REQUEST_STATUS_LABEL,
  tripStatus: TRIP_STATUS_LABEL,
  stopStatus: STOP_STATUS_LABEL,
  disputeStatus: DISPUTE_STATUS_LABEL,
  payState: PAY_STATE_LABEL,
  party: PARTY_LABEL,
  quality: QUALITY_LABEL,
  expenseType: EXPENSE_TYPE_LABEL,
  obligationType: OBLIGATION_TYPE_LABEL,
  paymentKind: PAYMENT_KIND_LABEL,
  attachmentKind: ATTACHMENT_KIND_LABEL,
  volume: VOLUME_LABEL,
  discrepancyDecision: DISCREPANCY_DECISION_LABEL,
  late: "Kechikmoqda",
  dispute: "Bahs",
};

const ru: EnumLabels = {
  role: { SHOP: "Сотрудник магазина", COLLECTOR: "Сборщик", OPERATOR: "Оператор" },
  requestStatus: {
    NEW: "Новый",
    PLANNED: "Включён в рейс",
    COLLECTED: "Забран — ждёт подтверждения",
    SKIPPED: "Перенесён",
    CONFIRMED: "Подтверждён",
    DISPUTED: "Спорный",
    SETTLED: "Расчёт закрыт",
    CANCELLED: "Отменён",
  },
  tripStatus: {
    PLANNED: "Запланирован",
    IN_PROGRESS: "В пути",
    COLLECTED: "Сбор завершён",
    ACCEPTED: "Покупатель принял",
    AWAITING_PAYMENT: "Ожидает оплаты",
    CLOSED: "Закрыт",
    CANCELLED: "Отменён",
  },
  stopStatus: { PENDING: "В очереди", COLLECTED: "Забрано", SKIPPED: "Перенесено", REMOVED: "Убрано из рейса" },
  disputeStatus: { OPEN: "Спор открыт", DECIDED: "Спор: решение вынесено, ждём согласия", RESOLVED: "Спор решён" },
  payState: { UNPAID: "Не оплачено", PARTIAL: "Оплачено частично", PAID: "Оплачено", OVERPAID: "Переплата" },
  party: { ECO_POINT: "Eco Point", COLLECTOR: "Сборщик-партнёр", BUYER: "Покупатель", SHOP: "Магазин", OTHER: "Другая сторона" },
  quality: { GOOD: "Хорошее — сухой, чистый", ACCEPTABLE: "Удовлетворительное — немного смешан", POOR: "Низкое — влажный или загрязнён" },
  expenseType: { TRANSPORT: "Транспорт", LOADING: "Погрузка", OTHER: "Прочие расходы" },
  obligationType: { BUYER_MATERIAL: "Оплата за материал", SHOP_PAYOUT: "Оплата магазину за картон", SERVICE_FEE: "Сервисный сбор Eco Point" },
  paymentKind: { PAYMENT: "Платёж", REFUND: "Возврат" },
  attachmentKind: { REQUEST_PHOTO: "Фото картона", SCALE_PHOTO: "Фото весов", ACCEPTANCE_DOC: "Документ приёмки" },
  volume: { SMALL: "Малый — 1–3 мешка", MEDIUM: "Средний — 4–8 мешков", LARGE: "Большой — 9+ мешков или куча" },
  discrepancyDecision: { TRIP_ABSORBS: "Расхождение за счёт рейса — не списывается на магазины", OTHER: "Другое решение (с комментарием)" },
  late: "Опаздывает",
  dispute: "Спор",
};

const en: EnumLabels = {
  role: { SHOP: "Shop staff", COLLECTOR: "Collector", OPERATOR: "Operator" },
  requestStatus: {
    NEW: "New",
    PLANNED: "In a trip",
    COLLECTED: "Collected — awaiting confirmation",
    SKIPPED: "Skipped",
    CONFIRMED: "Confirmed",
    DISPUTED: "Disputed",
    SETTLED: "Settled",
    CANCELLED: "Cancelled",
  },
  tripStatus: {
    PLANNED: "Planned",
    IN_PROGRESS: "On the road",
    COLLECTED: "Collection done",
    ACCEPTED: "Accepted by buyer",
    AWAITING_PAYMENT: "Awaiting payment",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  },
  stopStatus: { PENDING: "Pending", COLLECTED: "Collected", SKIPPED: "Skipped", REMOVED: "Removed from trip" },
  disputeStatus: { OPEN: "Dispute open", DECIDED: "Dispute: decision made, awaiting agreement", RESOLVED: "Dispute resolved" },
  payState: { UNPAID: "Unpaid", PARTIAL: "Partly paid", PAID: "Paid", OVERPAID: "Overpaid" },
  party: { ECO_POINT: "Eco Point", COLLECTOR: "Partner collector", BUYER: "Buyer", SHOP: "Shop", OTHER: "Other party" },
  quality: { GOOD: "Good — dry, clean", ACCEPTABLE: "Acceptable — slightly mixed", POOR: "Poor — wet or contaminated" },
  expenseType: { TRANSPORT: "Transport", LOADING: "Loading", OTHER: "Other expense" },
  obligationType: { BUYER_MATERIAL: "Payment for material", SHOP_PAYOUT: "Cardboard payout to shop", SERVICE_FEE: "Eco Point service fee" },
  paymentKind: { PAYMENT: "Payment", REFUND: "Refund" },
  attachmentKind: { REQUEST_PHOTO: "Cardboard photo", SCALE_PHOTO: "Scale photo", ACCEPTANCE_DOC: "Acceptance document" },
  volume: { SMALL: "Small — 1–3 bags", MEDIUM: "Medium — 4–8 bags", LARGE: "Large — 9+ bags or a pile" },
  discrepancyDecision: { TRIP_ABSORBS: "Discrepancy absorbed by the trip — not charged to shops", OTHER: "Other decision (with note)" },
  late: "Late",
  dispute: "Dispute",
};

export const ENUM_LABELS: Record<Locale, EnumLabels> = { uz, ru, en };

export function labelsFor(locale: Locale): EnumLabels {
  return ENUM_LABELS[locale];
}

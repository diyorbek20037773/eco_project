// O‘zbekcha yorliqlar (UI mikrocopy). Barcha enum’lar uchun yagona joy.
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

/** Rang ohangi — har doim matn bilan birga ishlatiladi (rang yagona signal emas). */
export type Tone = "neutral" | "info" | "progress" | "success" | "warning" | "danger" | "muted";

export const ROLE_LABEL: Record<Role, string> = {
  SHOP: "Do‘kon xodimi",
  COLLECTOR: "Yig‘uvchi",
  OPERATOR: "Operator",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  NEW: "Yangi",
  PLANNED: "Reysga kiritildi",
  COLLECTED: "Olindi — tasdiq kutilmoqda",
  SKIPPED: "Qoldirildi",
  CONFIRMED: "Tasdiqlandi",
  DISPUTED: "Bahsli",
  SETTLED: "Hisob yopildi",
  CANCELLED: "Bekor qilindi",
};

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = {
  NEW: "info",
  PLANNED: "progress",
  COLLECTED: "warning",
  SKIPPED: "warning",
  CONFIRMED: "success",
  DISPUTED: "danger",
  SETTLED: "success",
  CANCELLED: "muted",
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNED: "Rejalashtirilgan",
  IN_PROGRESS: "Yo‘lda",
  COLLECTED: "Yig‘ib bo‘lindi",
  ACCEPTED: "Xaridor qabul qildi",
  AWAITING_PAYMENT: "To‘lov kutilmoqda",
  CLOSED: "Yopildi",
  CANCELLED: "Bekor qilindi",
};

export const TRIP_STATUS_TONE: Record<TripStatus, Tone> = {
  PLANNED: "info",
  IN_PROGRESS: "progress",
  COLLECTED: "progress",
  ACCEPTED: "progress",
  AWAITING_PAYMENT: "warning",
  CLOSED: "success",
  CANCELLED: "muted",
};

export const STOP_STATUS_LABEL: Record<StopStatus, string> = {
  PENDING: "Navbatda",
  COLLECTED: "Olindi",
  SKIPPED: "Qoldirildi",
  REMOVED: "Reysdan olib tashlandi",
};

export const STOP_STATUS_TONE: Record<StopStatus, Tone> = {
  PENDING: "info",
  COLLECTED: "success",
  SKIPPED: "warning",
  REMOVED: "muted",
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: "Bahs ochiq",
  DECIDED: "Bahs: qaror chiqdi, rozilik kutilmoqda",
  RESOLVED: "Bahs hal qilindi",
};

export const DISPUTE_STATUS_TONE: Record<DisputeStatus, Tone> = {
  OPEN: "danger",
  DECIDED: "danger",
  RESOLVED: "success",
};

export const PAY_STATE_LABEL: Record<PayState, string> = {
  UNPAID: "To‘lanmagan",
  PARTIAL: "Qisman to‘langan",
  PAID: "To‘langan",
  OVERPAID: "Ortiqcha to‘langan",
};

export const PAY_STATE_TONE: Record<PayState, Tone> = {
  UNPAID: "warning",
  PARTIAL: "warning",
  PAID: "success",
  OVERPAID: "danger",
};

export const PARTY_LABEL: Record<Party, string> = {
  ECO_POINT: "Eco Point",
  COLLECTOR: "Hamkor yig‘uvchi",
  BUYER: "Xaridor",
  SHOP: "Do‘kon",
  OTHER: "Boshqa tomon",
};

export const QUALITY_LABEL: Record<Quality, string> = {
  GOOD: "Yaxshi — quruq, toza",
  ACCEPTABLE: "Qoniqarli — biroz aralash",
  POOR: "Past — nam yoki ifloslangan",
};

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  TRANSPORT: "Transport",
  LOADING: "Yuklash",
  OTHER: "Boshqa xarajat",
};

export const OBLIGATION_TYPE_LABEL: Record<ObligationType, string> = {
  BUYER_MATERIAL: "Material uchun to‘lov",
  SHOP_PAYOUT: "Do‘konga karton haqi",
  SERVICE_FEE: "Eco Point xizmat haqi",
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  PAYMENT: "To‘lov",
  REFUND: "Qaytarish",
};

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  REQUEST_PHOTO: "Karton rasmi",
  SCALE_PHOTO: "Tarozi rasmi",
  ACCEPTANCE_DOC: "Qabul hujjati",
};

export const VOLUME_LABEL: Record<VolumeSize, string> = {
  SMALL: "Kichik — 1–3 qop",
  MEDIUM: "O‘rta — 4–8 qop",
  LARGE: "Katta — 9+ qop yoki to‘da",
};

export const DISCREPANCY_DECISION_LABEL: Record<DiscrepancyDecision, string> = {
  TRIP_ABSORBS: "Tafovut reys hisobiga — do‘konlarga yozilmaydi",
  OTHER: "Boshqa qaror (izoh bilan)",
};

export const SKIP_REASONS = ["Karton tayyor emas", "Do‘kon yopiq", "Boshqa sabab"] as const;

export const PAYMENT_METHODS = ["Naqd", "Bank o‘tkazmasi", "Karta", "Boshqa"] as const;

export const VOLUME_OPTIONS: VolumeSize[] = ["SMALL", "MEDIUM", "LARGE"];
export const QUALITY_OPTIONS: Quality[] = ["GOOD", "ACCEPTABLE", "POOR"];
export const EXPENSE_OPTIONS: ExpenseType[] = ["TRANSPORT", "LOADING", "OTHER"];
export const PARTY_OPTIONS: Party[] = ["COLLECTOR", "ECO_POINT", "BUYER", "SHOP", "OTHER"];

/**
 * ASCII apostrofni o‘zbek lotin belgilariga almashtiradi:
 * o' / g' → o‘ / g‘, qolgan ' → ’ (tutuq). Server va domen matnlarini ko‘rsatishda ishlatiladi.
 */
export function uzText(text: string): string {
  return text.replace(/([oOgG])'/g, "$1‘").replace(/'/g, "’");
}

/** "Nur market" + "Nur market — Markaz" → "Nur market — Markaz" (do‘kon nomi takrorlanmaydi). */
export function pointTitle(point: { shopName: string; name: string }): string {
  return point.name.toLowerCase().includes(point.shopName.toLowerCase()) ? point.name : `${point.shopName} — ${point.name}`;
}

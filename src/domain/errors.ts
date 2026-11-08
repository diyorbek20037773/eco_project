// Domain xatolari: mashina kodi + foydalanuvchiga ko'rsatiladigan o'zbekcha matn.
import type { ActionResult, ErrorCode } from "@/server/contract";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  toResult(): ActionResult<never> {
    return this.fieldErrors
      ? { ok: false, code: this.code, error: this.message, fieldErrors: this.fieldErrors }
      : { ok: false, code: this.code, error: this.message };
  }
}

export const MESSAGES = {
  UNAUTHENTICATED: "Avval tizimga kiring.",
  FORBIDDEN: "Bu amal sizning rolingiz uchun ruxsat etilmagan.",
  NOT_FOUND: "Ma’lumot topilmadi yoki unga ruxsatingiz yo‘q.",
  VALIDATION: "Formadagi xatolarni tuzating.",
  INVALID_TRANSITION: "Bu amalni joriy holatda bajarib bo‘lmaydi.",
  CONFLICT: "Ma’lumot boshqa foydalanuvchi tomonidan o‘zgartirildi. Sahifani yangilab qayta urinib ko‘ring.",
  DUPLICATE: "Bunday yozuv allaqachon mavjud.",
  OVERPAYMENT: "To‘lov summasi qoldiqdan oshib ketdi.",
  UPLOAD_INVALID: "Faqat 5 MB gacha JPEG, PNG yoki WebP rasm yuklash mumkin.",
  INTERNAL: "Kutilmagan xato. Qayta urinib ko‘ring.",
} as const satisfies Record<ErrorCode, string>;

export const unauthenticated = (msg: string = MESSAGES.UNAUTHENTICATED) => new DomainError("UNAUTHENTICATED", msg);
export const forbidden = (msg: string = MESSAGES.FORBIDDEN) => new DomainError("FORBIDDEN", msg);
export const notFound = (msg: string = MESSAGES.NOT_FOUND) => new DomainError("NOT_FOUND", msg);
export const validation = (msg: string = MESSAGES.VALIDATION, fieldErrors?: Record<string, string>) =>
  new DomainError("VALIDATION", msg, fieldErrors);
export const fieldError = (field: string, msg: string) => new DomainError("VALIDATION", msg, { [field]: msg });
export const invalidTransition = (msg: string = MESSAGES.INVALID_TRANSITION) => new DomainError("INVALID_TRANSITION", msg);
export const conflict = (msg: string = MESSAGES.CONFLICT) => new DomainError("CONFLICT", msg);
export const duplicate = (msg: string = MESSAGES.DUPLICATE, fieldErrors?: Record<string, string>) =>
  new DomainError("DUPLICATE", msg, fieldErrors);
export const overpayment = (msg: string = MESSAGES.OVERPAYMENT) => new DomainError("OVERPAYMENT", msg);
export const uploadInvalid = (msg: string = MESSAGES.UPLOAD_INVALID) => new DomainError("UPLOAD_INVALID", msg);

export function internalError(): ActionResult<never> {
  return { ok: false, code: "INTERNAL", error: MESSAGES.INTERNAL };
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

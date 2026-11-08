// DB qatorlari → kontrakt DTO'lari. Barcha o'qish yo'llari shu mapperlardan foydalanadi.
import type { Prisma } from "@/generated/prisma/client";
import type {
  AttachmentDTO,
  BuyerDTO,
  DisputeDTO,
  ObligationDTO,
  PaymentDTO,
  PointDTO,
  StopDTO,
  TariffDTO,
} from "@/server/contract";
import { effectiveNetGrams, paidAmount, payState } from "@/domain/settlement";
import { fileUrl } from "@/server/services/upload";

// ---------------------------------------------------------------------------
// Include shakllari
// ---------------------------------------------------------------------------
export const pointInclude = { shop: { select: { name: true } } } satisfies Prisma.PointInclude;
export type PointRow = Prisma.PointGetPayload<{ include: typeof pointInclude }>;

export const attachmentSelect = { id: true, kind: true, mimeType: true, createdAt: true } satisfies Prisma.AttachmentSelect;
type AttachmentRow = Prisma.AttachmentGetPayload<{ select: typeof attachmentSelect }>;

export const disputeInclude = {
  openedBy: { select: { name: true } },
  decidedBy: { select: { name: true } },
} satisfies Prisma.DisputeInclude;
export type DisputeRow = Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>;

export const stopInclude = {
  trip: { select: { id: true, number: true } },
  request: {
    include: {
      attachments: { select: attachmentSelect, orderBy: { createdAt: "asc" } },
      point: { include: pointInclude },
    },
  },
  weighing: {
    include: {
      photos: { select: attachmentSelect, orderBy: { createdAt: "asc" } },
      recordedBy: { select: { name: true } },
    },
  },
  confirmation: { include: { user: { select: { name: true } } } },
  disputes: { include: disputeInclude, orderBy: { createdAt: "asc" } },
} satisfies Prisma.TripStopInclude;
export type StopRow = Prisma.TripStopGetPayload<{ include: typeof stopInclude }>;

export const obligationInclude = {
  shop: { select: { name: true } },
  payments: { include: { recordedBy: { select: { name: true } } }, orderBy: { paidAt: "asc" } },
} satisfies Prisma.ObligationInclude;
export type ObligationRow = Prisma.ObligationGetPayload<{ include: typeof obligationInclude }>;

// ---------------------------------------------------------------------------
// Mapperlar
// ---------------------------------------------------------------------------
export function toAttachment(a: AttachmentRow): AttachmentDTO {
  return { id: a.id, kind: a.kind, url: fileUrl(a.id), mimeType: a.mimeType, createdAt: a.createdAt };
}

export function toPoint(p: PointRow): PointDTO {
  return {
    id: p.id,
    shopId: p.shopId,
    shopName: p.shop.name,
    name: p.name,
    address: p.address,
    district: p.district,
    landmark: p.landmark,
    contactName: p.contactName,
    contactPhone: p.contactPhone,
  };
}

export function toDispute(d: DisputeRow): DisputeDTO {
  return {
    id: d.id,
    stopId: d.stopId,
    status: d.status,
    reason: d.reason,
    claimedNetGrams: d.claimedNetGrams,
    openedByName: d.openedBy.name,
    createdAt: d.createdAt,
    decisionText: d.decisionText,
    decidedNetGrams: d.decidedNetGrams,
    decidedByName: d.decidedBy?.name ?? null,
    decidedAt: d.decidedAt,
    shopAckAt: d.shopAckAt,
    collectorAckAt: d.collectorAckAt,
    lastRejectComment: d.lastRejectComment,
    resolvedAt: d.resolvedAt,
  };
}

export function stopEffectiveNet(s: {
  status: StopRow["status"];
  weighing: { netGrams: number } | null;
  disputes: { status: DisputeRow["status"]; decidedNetGrams: number | null; resolvedAt: Date | null }[];
}): number | null {
  return effectiveNetGrams(s.status, s.weighing?.netGrams ?? null, s.disputes);
}

export function toStop(s: StopRow): StopDTO {
  return {
    id: s.id,
    tripId: s.tripId,
    tripNumber: s.trip.number,
    sequence: s.sequence,
    status: s.status,
    request: {
      id: s.request.id,
      number: s.request.number,
      readyFrom: s.request.readyFrom,
      readyTo: s.request.readyTo,
      estimatedGrams: s.request.estimatedGrams,
      volume: s.request.volume,
      note: s.request.note,
      photos: s.request.attachments.map(toAttachment),
    },
    point: toPoint(s.request.point),
    weighing: s.weighing
      ? {
          id: s.weighing.id,
          grossGrams: s.weighing.grossGrams,
          tareGrams: s.weighing.tareGrams,
          netGrams: s.weighing.netGrams,
          recordedAt: s.weighing.recordedAt,
          recordedByName: s.weighing.recordedBy.name,
          photos: s.weighing.photos.map(toAttachment),
        }
      : null,
    confirmation: s.confirmation
      ? { status: s.confirmation.status, reason: s.confirmation.reason, at: s.confirmation.createdAt, byName: s.confirmation.user.name }
      : null,
    disputes: s.disputes.map(toDispute),
    effectiveNetGrams: stopEffectiveNet(s),
    skipReason: s.skipReason,
    skippedAt: s.skippedAt,
    collectedAt: s.collectedAt,
  };
}

export function toPayment(p: ObligationRow["payments"][number]): PaymentDTO {
  return { id: p.id, kind: p.kind, amount: p.amount, paidAt: p.paidAt, method: p.method, reference: p.reference, recordedByName: p.recordedBy.name };
}

export function toObligation(o: ObligationRow): ObligationDTO {
  const paid = paidAmount(o.payments);
  return {
    id: o.id,
    type: o.type,
    payer: o.payer,
    payee: o.payee,
    shopId: o.shopId,
    shopName: o.shop?.name ?? null,
    stopId: o.stopId,
    amount: o.amount,
    paid,
    remaining: o.amount - paid,
    state: payState(o.amount, paid),
    payments: o.payments.map(toPayment),
  };
}

const OBLIGATION_ORDER = { BUYER_MATERIAL: 0, SHOP_PAYOUT: 1, SERVICE_FEE: 2 } as const;
export function sortObligations<T extends { type: keyof typeof OBLIGATION_ORDER }>(list: T[]): T[] {
  return [...list].sort((a, b) => OBLIGATION_ORDER[a.type] - OBLIGATION_ORDER[b.type]);
}

export function toBuyer(b: Prisma.BuyerGetPayload<object>): BuyerDTO {
  return {
    id: b.id,
    name: b.name,
    contactName: b.contactName,
    phone: b.phone,
    address: b.address,
    qualityTerms: b.qualityTerms,
    minBatchGrams: b.minBatchGrams,
    isActive: b.isActive,
  };
}

export function toTariff(t: Prisma.TariffGetPayload<object>): TariffDTO {
  return { id: t.id, shopPricePerKg: t.shopPricePerKg, buyerPricePerKg: t.buyerPricePerKg, serviceFee: t.serviceFee, validFrom: t.validFrom, note: t.note };
}

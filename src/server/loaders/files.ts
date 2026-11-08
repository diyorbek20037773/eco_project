// Ilova fayliga ruxsat (docs/contract.md §4):
// operator — hammasi; do'kon — o'z buyurtmasi va o'z bekati tortish rasmlari;
// yig'uvchi — o'z reysidagi buyurtma/tortish rasmlari; qabul hujjati — faqat operator;
// bog'lanmagan fayl — faqat yuklagan o'zi (oldindan ko'rish uchun). Aks holda null (→ 404).
import { prisma } from "@/lib/db";
import type { Actor } from "@/server/services/core";

export async function findViewableAttachment(actor: Actor, id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const a = await prisma.attachment.findUnique({
    where: { id },
    include: {
      request: { select: { shopId: true, stops: { where: { status: { not: "REMOVED" } }, select: { trip: { select: { collectorId: true } } } } } },
      weighing: { select: { stop: { select: { request: { select: { shopId: true } }, trip: { select: { collectorId: true } } } } } },
    },
  });
  if (!a) return null;
  if (actor.role === "OPERATOR") return a;

  const unlinked = !a.requestId && !a.weighingId && !a.acceptanceId;
  if (unlinked) return a.uploadedById === actor.id ? a : null;
  if (a.kind === "ACCEPTANCE_DOC" || a.acceptanceId) return null;

  if (actor.role === "SHOP") {
    if (!actor.shopId) return null;
    if (a.request && a.request.shopId === actor.shopId) return a;
    if (a.weighing && a.weighing.stop.request.shopId === actor.shopId) return a;
    return null;
  }
  if (actor.role === "COLLECTOR") {
    if (a.request && a.request.stops.some((s) => s.trip.collectorId === actor.id)) return a;
    if (a.weighing && a.weighing.stop.trip.collectorId === actor.id) return a;
    return null;
  }
  return null;
}

// Rasm yuklash: hajm, haqiqiy tur (magic bytes), yopiq omborga yozish, Attachment yozuvi.
import { prisma } from "@/lib/db";
import { saveImage, validateImage, deleteStoredFile, MAX_UPLOAD_BYTES } from "@/lib/storage";
import type { ActionResult, AttachmentKind } from "@/server/contract";
import { forbidden, uploadInvalid, validation } from "@/domain/errors";
import { ok, requireRole, run, type Actor, type Tx } from "./core";

const KIND_ROLE: Record<AttachmentKind, Actor["role"]> = {
  REQUEST_PHOTO: "SHOP",
  SCALE_PHOTO: "COLLECTOR",
  ACCEPTANCE_DOC: "OPERATOR",
};

export function fileUrl(id: string): string {
  return `/api/files/${id}`;
}

export async function uploadImage(
  actorIn: Actor | null,
  input: { file: unknown; kind: unknown },
): Promise<ActionResult<{ attachmentId: string; url: string }>> {
  return run(async () => {
    const actor = requireRole(actorIn, "SHOP", "COLLECTOR", "OPERATOR");
    const kind = input.kind;
    if (kind !== "REQUEST_PHOTO" && kind !== "SCALE_PHOTO" && kind !== "ACCEPTANCE_DOC") {
      throw validation("Fayl turi noto‘g‘ri.", { kind: "Fayl turi noto‘g‘ri." });
    }
    if (KIND_ROLE[kind] !== actor.role) throw forbidden();
    const file = input.file;
    if (!(file instanceof Blob) || file.size === 0) throw uploadInvalid("Rasm tanlanmagan.");
    if (file.size > MAX_UPLOAD_BYTES) throw uploadInvalid("Rasm hajmi 5 MB dan oshmasin.");
    const buf = new Uint8Array(await file.arrayBuffer());
    const check = validateImage(buf);
    if (!check.ok) {
      throw uploadInvalid(check.reason === "TOO_LARGE" ? "Rasm hajmi 5 MB dan oshmasin." : "Faqat JPEG, PNG yoki WebP rasm yuklash mumkin.");
    }
    const stored = await saveImage(buf, check.mime);
    try {
      const att = await prisma.attachment.create({
        data: {
          kind,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          uploadedById: actor.id,
        },
      });
      return ok({ attachmentId: att.id, url: fileUrl(att.id) });
    } catch (e) {
      await deleteStoredFile(stored.storageKey);
      throw e;
    }
  });
}

/**
 * Yuklangan rasmlarni obyektga bog'laydi. Faqat yuklagan o'zi, kerakli turdagi va hali
 * bog'lanmagan fayllar. Aks holda VALIDATION.
 */
export async function linkAttachments(
  tx: Tx,
  actorId: string,
  ids: readonly string[],
  kind: AttachmentKind,
  target: { requestId: string } | { weighingId: string } | { acceptanceId: string },
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  if (unique.length > 10) throw validation("Ko‘pi bilan 10 ta rasm biriktiring.");
  const r = await tx.attachment.updateMany({
    where: { id: { in: unique }, kind, uploadedById: actorId, requestId: null, weighingId: null, acceptanceId: null },
    data: target,
  });
  if (r.count !== unique.length) {
    throw validation("Rasm topilmadi yoki allaqachon boshqa yozuvga biriktirilgan. Qayta yuklang.", {
      photoAttachmentId: "Rasmni qayta yuklang.",
    });
  }
}

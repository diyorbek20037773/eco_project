"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { IconRefresh } from "@/components/ui/icons";
import { Notice } from "@/components/ui/States";
import { formatDateTime } from "@/lib/format";
import type { FormPhase } from "./use-action-form";

interface FormStatusApi {
  phase: FormPhase;
  pending: boolean;
  error: string | null;
  message: string | null;
  retry: () => void;
  draft: { savedAt: number; restore: () => void; discard: () => void } | null;
}

/**
 * Forma natijasi uchun yagona joy (aria-live): qoralama tiklash, tarmoq xatosi + «Qayta yuborish»,
 * server xatosi, muvaffaqiyat. Qayta yuborish xuddi shu clientKey bilan ketadi.
 */
export function FormStatus({
  form,
  success,
  hideSuccess,
  only,
}: {
  form: FormStatusApi;
  success?: ReactNode;
  hideSuccess?: boolean;
  /** "draft" — faqat qoralama taklifi (forma tepasida), "result" — faqat natija (tugma yonida) */
  only?: "draft" | "result";
}) {
  const showDraft = only !== "result";
  const showResult = only !== "draft";
  return (
    <div aria-live="polite" className="space-y-2 empty:hidden">
      {showDraft && form.draft ? (
        <Notice
          tone="info"
          title="Oldin kiritilgan ma’lumotlar saqlangan"
          actions={
            <>
              <Button size="sm" onClick={form.draft.restore}>
                Tiklash
              </Button>
              <Button size="sm" variant="ghost" onClick={form.draft.discard}>
                O‘chirish
              </Button>
            </>
          }
        >
          Saqlangan vaqti: {formatDateTime(new Date(form.draft.savedAt))}
        </Notice>
      ) : null}

      {showResult && form.phase === "network" && form.error ? (
        <Notice
          tone="danger"
          title="Yuborilmadi"
          actions={
            <Button size="sm" onClick={form.retry} loading={form.pending} icon={<IconRefresh size={16} />}>
              Qayta yuborish
            </Button>
          }
        >
          {form.error}
        </Notice>
      ) : null}

      {showResult && form.phase === "error" && form.error ? (
        <Notice tone="danger" title="Saqlanmadi">
          {form.error}
        </Notice>
      ) : null}

      {showResult && form.phase === "success" && !hideSuccess ? (
        <Notice tone="success" title={success ?? form.message ?? "Saqlandi."} />
      ) : null}
    </div>
  );
}

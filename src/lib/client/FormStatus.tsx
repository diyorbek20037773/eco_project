"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { IconRefresh } from "@/components/ui/icons";
import { Notice } from "@/components/ui/States";
import { fmt } from "@/i18n/config";
import { COMMON_DICT, formatDateTimeL } from "@/i18n/common";
import { useDict, useLocale } from "@/i18n/LocaleProvider";
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
  const locale = useLocale();
  const t = useDict(COMMON_DICT).form;
  const showDraft = only !== "result";
  const showResult = only !== "draft";
  return (
    <div aria-live="polite" className="space-y-2 empty:hidden">
      {showDraft && form.draft ? (
        <Notice
          tone="info"
          title={t.draftTitle}
          actions={
            <>
              <Button size="sm" onClick={form.draft.restore}>
                {t.draftRestore}
              </Button>
              <Button size="sm" variant="ghost" onClick={form.draft.discard}>
                {t.draftDiscard}
              </Button>
            </>
          }
        >
          {fmt(t.draftSavedAt, { time: formatDateTimeL(new Date(form.draft.savedAt), locale) })}
        </Notice>
      ) : null}

      {showResult && form.phase === "network" && form.error ? (
        <Notice
          tone="danger"
          title={t.notSent}
          actions={
            <Button size="sm" onClick={form.retry} loading={form.pending} icon={<IconRefresh size={16} />}>
              {t.resend}
            </Button>
          }
        >
          {form.error}
        </Notice>
      ) : null}

      {showResult && form.phase === "error" && form.error ? (
        <Notice tone="danger" title={t.notSaved}>
          {form.error}
        </Notice>
      ) : null}

      {showResult && form.phase === "success" && !hideSuccess ? (
        <Notice tone="success" title={success ?? form.message ?? t.saved} />
      ) : null}
    </div>
  );
}

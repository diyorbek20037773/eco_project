"use client";

import type { AttachmentDTO } from "@/server/contract";
import { COMMON_DICT, formatDateTimeL } from "@/i18n/common";
import { labelsFor } from "@/i18n/labels";
import { useDict, useLocale } from "@/i18n/LocaleProvider";

/** Biriktirilgan rasmlar: kichik ko‘rinish + to‘liq rasmni yangi oynada ochish (sessiya bilan himoyalangan URL). */
export function Thumbs({ items, label }: { items: AttachmentDTO[]; label?: string }) {
  const locale = useLocale();
  const t = useDict(COMMON_DICT).thumbs;
  const kinds = labelsFor(locale).attachmentKind;
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label ?? t.label}>
      {items.map((a, i) => (
        <li key={a.id}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener"
            className="block overflow-hidden rounded-lg border border-line-strong bg-surface"
            title={`${kinds[a.kind]} · ${formatDateTimeL(a.createdAt, locale)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- yopiq /api/files URL, optimizatsiyasiz */}
            <img
              src={a.url}
              alt={`${kinds[a.kind]} ${i + 1}`}
              width={88}
              height={88}
              loading="lazy"
              className="size-22 object-cover"
            />
            <span className="sr-only">{t.openFull}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

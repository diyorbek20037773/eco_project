import type { AttachmentDTO } from "@/server/contract";
import { ATTACHMENT_KIND_LABEL } from "@/domain/labels";
import { formatDateTime } from "@/lib/format";

/** Biriktirilgan rasmlar: kichik ko‘rinish + to‘liq rasmni yangi oynada ochish (sessiya bilan himoyalangan URL). */
export function Thumbs({ items, label }: { items: AttachmentDTO[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label ?? "Rasmlar"}>
      {items.map((a, i) => (
        <li key={a.id}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener"
            className="block overflow-hidden rounded-lg border border-line-strong bg-surface"
            title={`${ATTACHMENT_KIND_LABEL[a.kind]} · ${formatDateTime(a.createdAt)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- yopiq /api/files URL, optimizatsiyasiz */}
            <img
              src={a.url}
              alt={`${ATTACHMENT_KIND_LABEL[a.kind]} ${i + 1}`}
              width={88}
              height={88}
              loading="lazy"
              className="size-22 object-cover"
            />
            <span className="sr-only">— to‘liq o‘lchamda ochish</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

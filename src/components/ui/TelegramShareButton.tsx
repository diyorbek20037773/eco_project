"use client";

import { useState } from "react";
import { Button, LinkButton } from "./Button";
import { IconCopy, IconShare } from "./icons";

/**
 * Telegram’da ulashish: t.me/share havolasi (bot tokeni kerak emas).
 * Havola tizimga kirishni talab qiladi — begona odam ma’lumotni ko‘ra olmaydi.
 */
export function TelegramShareButton({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <LinkButton href={href} external target="_blank" rel="noopener noreferrer" variant="secondary" icon={<IconShare />}>
          Telegram’da ulashish
        </LinkButton>
        <Button variant="ghost" onClick={() => void copy()} icon={<IconCopy />}>
          Havolani nusxalash
        </Button>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {copied === "ok"
          ? "Havola nusxalandi."
          : copied === "fail"
            ? `Nusxalab bo‘lmadi. Havola: ${url}`
            : "Havola faqat tizimga kirgan operatorga ochiladi."}
      </p>
    </div>
  );
}

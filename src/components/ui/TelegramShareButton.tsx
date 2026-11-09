"use client";

import { useState } from "react";
import { Button, LinkButton } from "./Button";
import { IconCopy, IconShare } from "./icons";
import { fmt } from "@/i18n/config";
import { COMMON_DICT } from "@/i18n/common";
import { useDict } from "@/i18n/LocaleProvider";

/**
 * Telegram’da ulashish: t.me/share havolasi (bot tokeni kerak emas).
 * Havola tizimga kirishni talab qiladi — begona odam ma’lumotni ko‘ra olmaydi.
 */
export function TelegramShareButton({ url, text }: { url: string; text: string }) {
  const t = useDict(COMMON_DICT).share;
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
          {t.telegram}
        </LinkButton>
        <Button variant="ghost" onClick={() => void copy()} icon={<IconCopy />}>
          {t.copy}
        </Button>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {copied === "ok" ? t.copied : copied === "fail" ? fmt(t.copyFailed, { url }) : t.hint}
      </p>
    </div>
  );
}

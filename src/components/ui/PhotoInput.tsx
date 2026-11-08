"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AttachmentKind } from "@/server/contract";
import { uploadImage } from "@/server/actions/upload";
import { uzText } from "@/domain/labels";
import { Button } from "./Button";
import { IconCamera, IconImage, IconRefresh, IconX } from "./icons";
import { cx } from "./cx";

const MAX_BYTES = 5 * 1024 * 1024;

type Status = "idle" | "uploading" | "done" | "error";

/**
 * Rasm olish/yuklash: kamera (capture="environment") yoki galereya. Tanlangach darhol
 * `uploadImage` orqali yopiq omborga yuklanadi va attachmentId qaytariladi.
 */
export function PhotoInput({
  kind,
  label,
  hint,
  value,
  onChange,
  onUploadingChange,
}: {
  kind: AttachmentKind;
  label: string;
  hint?: string;
  value: string | null;
  onChange: (attachmentId: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const baseId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(value ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function upload(f: File) {
    setStatus("uploading");
    setError(null);
    onUploadingChange?.(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", kind);
      const res = await uploadImage(fd);
      if (res.ok) {
        setStatus("done");
        onChange(res.data.attachmentId);
      } else {
        setStatus("error");
        setError(uzText(res.error));
        onChange(null);
      }
    } catch {
      setStatus("error");
      setError("Rasm yuklanmadi: internet aloqasini tekshiring va «Qayta yuklash»ni bosing.");
      onChange(null);
    } finally {
      onUploadingChange?.(false);
    }
  }

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setStatus("error");
      setError("Faqat rasm (JPEG, PNG yoki WebP) yuklash mumkin.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setStatus("error");
      setError("Rasm 5 MB dan katta. Kichikroq rasm tanlang yoki kamera sifatini pasaytiring.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    void upload(f);
  }

  function clear() {
    setFile(null);
    setPreview(null);
    setStatus("idle");
    setError(null);
    onChange(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  const hintId = `${baseId}-hint`;
  const statusId = `${baseId}-status`;
  const busy = status === "uploading";

  return (
    <fieldset className="min-w-0" aria-describedby={cx(hint && hintId, statusId) || undefined}>
      <legend className="mb-1 text-sm font-semibold">
        {label} <span className="font-normal text-muted">(ixtiyoriy)</span>
      </legend>
      {hint ? (
        <p id={hintId} className="mb-2 text-sm text-muted">
          {hint}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- mahalliy blob ko‘rinishi
          <img src={preview} alt="Tanlangan rasm" className="size-24 rounded-lg border border-line-strong object-cover" />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label
            className={cx(
              "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 font-semibold hover:bg-primary-soft",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <IconCamera />
            <span>{preview ? "Qayta suratga olish" : "Suratga olish"}</span>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={busy}
              onChange={(e) => pick(e.target.files)}
            />
          </label>
          <label
            className={cx(
              "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 font-semibold hover:bg-primary-soft",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <IconImage />
            <span>Galereyadan tanlash</span>
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => pick(e.target.files)}
            />
          </label>
          {status === "done" || status === "error" ? (
            <Button variant="ghost" onClick={clear} icon={<IconX />}>
              Rasmni olib tashlash
            </Button>
          ) : null}
        </div>
      </div>

      <div id={statusId} aria-live="polite" className="mt-2 text-sm">
        {status === "uploading" ? <p className="font-semibold text-muted">Rasm yuklanmoqda…</p> : null}
        {status === "done" ? <p className="font-semibold text-primary">✓ Rasm yuklandi</p> : null}
        {status === "error" && error ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-danger">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
            {file ? (
              <Button size="sm" variant="secondary" onClick={() => void upload(file)} icon={<IconRefresh size={16} />}>
                Qayta yuklash
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

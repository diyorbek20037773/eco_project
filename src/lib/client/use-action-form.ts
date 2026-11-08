"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/contract";
import { uzText } from "@/domain/labels";
import { newClientKey } from "./client-key";
import { flash } from "./flash";
import { clearDraft, parseDraft, readDraftRaw, subscribeDrafts, type Draft } from "./draft";

export type FormValues = Record<string, string>;
export type FormPhase = "idle" | "pending" | "success" | "error" | "network";

export const NETWORK_ERROR_TEXT = "Internet aloqasi yo‘q. Ma’lumotlar saqlandi — «Qayta yuborish»ni bosing.";
export const SERVER_UNREACHABLE_TEXT =
  "Server javob bermadi. Ma’lumotlar saqlandi — biroz kutib «Qayta yuborish»ni bosing.";

export interface UseActionFormOptions<V extends FormValues, T> {
  initialValues: V;
  /** localStorage qoralama kaliti. Berilmasa qoralama saqlanmaydi. */
  draftKey?: string;
  successMessage?: string | ((data: T) => string);
  onSuccess?: (data: T, info: { message?: string; replayed?: boolean }) => void;
  /** Muvaffaqiyatdan keyin qiymatlarni boshlang‘ich holatga qaytarish (default: true) */
  resetOnSuccess?: boolean;
  /** Muvaffaqiyatdan keyin router.refresh() (default: true) */
  refresh?: boolean;
  /**
   * Muvaffaqiyat xabari ko‘rinib turgan forma ekrandan olib tashlansa (masalan, refresh’dan keyin
   * karta yo‘qolsa), xabar sahifa toast’iga o‘tadi (default: true). Boshqa sahifaga o‘tadigan
   * formalarda false.
   */
  flash?: boolean;
}

export type FormRunner<V extends FormValues, T> = (ctx: { clientKey: string; values: V }) => Promise<ActionResult<T>>;

function writeDraftSafe<V>(key: string | undefined, draft: Draft<V>) {
  if (!key) return;
  try {
    window.localStorage.setItem("ecopoint:draft:" + key, JSON.stringify(draft));
  } catch {
    // saqlab bo‘lmadi — qiymatlar xotirada qoladi
  }
}

function isOffline(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return err instanceof TypeError; // fetch tarmoq xatosi
}

/**
 * Server amali bilan ishlaydigan forma holati:
 * - clientKey mount’da bir marta yaratiladi, faqat muvaffaqiyatdan keyin yangilanadi
 *   (tarmoq xatosidan keyin «Qayta yuborish» xuddi shu kalit bilan — idempotent);
 * - qiymatlar localStorage qoralamasiga yoziladi (sahifa yangilansa «Tiklash» taklif qilinadi);
 * - yuborish paytida ikkinchi bosish e’tiborsiz qoldiriladi.
 */
export function useActionForm<V extends FormValues, T = undefined>(opts: UseActionFormOptions<V, T>) {
  const router = useRouter();
  const { draftKey } = opts;
  // null = joriy opts.initialValues (refresh'dan keyingi yangi boshlang‘ich qiymatlar ham shu orqali tushadi)
  const [stored, setValuesState] = useState<V | null>(null);
  const values: V = stored ?? opts.initialValues;
  const [clientKey, setClientKey] = useState<string>(newClientKey);
  const [phase, setPhase] = useState<FormPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [touched, setTouched] = useState(false);
  const lastRun = useRef<FormRunner<V, T> | null>(null);
  const shownSuccess = useRef<string | null>(null);
  const flashOnUnmount = opts.flash !== false;
  useEffect(() => {
    shownSuccess.current = phase === "success" && message ? message : null;
  }, [phase, message]);
  useEffect(() => {
    if (!flashOnUnmount) return;
    return () => {
      if (shownSuccess.current) flash(shownSuccess.current);
    };
  }, [flashOnUnmount]);
  const inFlight = useRef(false);

  const rawDraft = useSyncExternalStore(
    subscribeDrafts,
    () => (draftKey ? readDraftRaw(draftKey) : null),
    () => null,
  );
  const savedDraft = !touched && draftKey ? parseDraft<V>(rawDraft) : null;

  function apply(next: V) {
    setValuesState(next);
    setTouched(true);
    writeDraftSafe(draftKey, { values: next, clientKey, savedAt: Date.now() });
  }

  function patch(partial: Partial<V>) {
    const next = { ...values, ...partial } as V;
    apply(next);
    if (Object.keys(partial).some((k) => fieldErrors[k])) {
      const rest = { ...fieldErrors };
      for (const k of Object.keys(partial)) delete rest[k];
      setFieldErrors(rest);
    }
    if (phase === "success") {
      setPhase("idle");
      setMessage(null);
    }
  }

  function setValue<K extends keyof V & string>(name: K, value: string) {
    patch({ [name]: value } as Partial<V>);
  }

  async function execute(run: FormRunner<V, T>, key: string, vals: V): Promise<ActionResult<T> | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    lastRun.current = run;
    setPhase("pending");
    setError(null);
    setMessage(null);
    if (touched) writeDraftSafe(draftKey, { values: vals, clientKey: key, savedAt: Date.now() });

    let result: ActionResult<T>;
    try {
      result = await run({ clientKey: key, values: vals });
    } catch (err) {
      inFlight.current = false;
      setPhase("network");
      setError(isOffline(err) ? NETWORK_ERROR_TEXT : SERVER_UNREACHABLE_TEXT);
      return null;
    }
    inFlight.current = false;

    if (!result.ok) {
      setPhase("error");
      setError(uzText(result.error));
      setFieldErrors(
        Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, uzText(v)])),
      );
      return result;
    }

    const custom =
      typeof opts.successMessage === "function" ? opts.successMessage(result.data) : opts.successMessage;
    setPhase("success");
    setData(result.data);
    setFieldErrors({});
    setMessage(uzText(custom ?? result.message ?? "Saqlandi."));
    if (draftKey) clearDraft(draftKey);
    setClientKey(newClientKey());
    if (opts.resetOnSuccess !== false) {
      setValuesState(null);
      setTouched(false);
    }
    if (opts.refresh !== false) router.refresh();
    opts.onSuccess?.(result.data, { message: result.message, replayed: result.replayed });
    return result;
  }

  function submit(run: FormRunner<V, T>) {
    return execute(run, clientKey, values);
  }

  function retry() {
    if (lastRun.current) void execute(lastRun.current, clientKey, values);
  }

  /** `<form onSubmit={handleSubmit(run)}>` */
  function handleSubmit(run: FormRunner<V, T>) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void submit(run);
    };
  }

  /** Mijoz tomonidagi tekshiruv xatosi (server chaqirilmaydi). */
  function fail(text: string, errors: Record<string, string> = {}) {
    setPhase("error");
    setError(text);
    setFieldErrors(errors);
  }

  function restoreDraft() {
    if (!savedDraft) return;
    setValuesState({ ...opts.initialValues, ...savedDraft.values });
    setClientKey(savedDraft.clientKey);
    setTouched(true);
  }

  function discardDraft() {
    if (draftKey) clearDraft(draftKey);
  }

  function dismiss() {
    setPhase("idle");
    setError(null);
    setMessage(null);
  }

  return {
    values,
    setValue,
    patch,
    clientKey,
    phase,
    pending: phase === "pending",
    error,
    fieldErrors,
    message,
    data,
    submit,
    retry,
    handleSubmit,
    fail,
    dismiss,
    draft: savedDraft ? { savedAt: savedDraft.savedAt, restore: restoreDraft, discard: discardDraft } : null,
  };
}

export type ActionFormApi<V extends FormValues = FormValues, T = unknown> = ReturnType<typeof useActionForm<V, T>>;

// Forma qoralamasi localStorage’da. Har qanday xato (yopiq rejim, to‘lgan xotira) jim o‘tkaziladi.
const PREFIX = "ecopoint:draft:";
const EVENT = "ecopoint-draft";

export interface Draft<V> {
  values: V;
  clientKey: string;
  savedAt: number;
}

export function readDraftRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function parseDraft<V>(raw: string | null): Draft<V> | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Draft<V>;
    if (!d || typeof d !== "object" || typeof d.clientKey !== "string" || !d.values) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeDraft<V>(key: string, draft: Draft<V>): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(draft));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // saqlab bo‘lmadi — forma baribir xotirada qoladi
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // e’tiborsiz
  }
}

export function subscribeDrafts(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

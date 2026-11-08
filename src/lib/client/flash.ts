// Sahifa darajasidagi qisqa xabar (toast). Forma muvaffaqiyatdan keyin router.refresh tufayli
// ekrandan olib tashlansa, uning xabari shu yerga o‘tadi va layout’da ko‘rinib turadi.
export interface FlashMessage {
  id: number;
  text: string;
}

let current: FlashMessage | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function flash(text: string): void {
  current = { id: ++seq, text };
  emit();
}

export function dismissFlash(id?: number): void {
  if (current && (id === undefined || current.id === id)) {
    current = null;
    emit();
  }
}

export function subscribeFlash(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readFlash(): FlashMessage | null {
  return current;
}

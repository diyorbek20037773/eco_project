// Server va mijoz komponentlarida birdek ishlatiladigan klass yordamchilari ("use client" emas).
import { cx } from "./cx";

export const inputClasses = (error?: string | null) =>
  cx(
    "block w-full min-h-12 rounded-xl border bg-surface px-3 py-2 text-base text-ink",
    "disabled:bg-canvas disabled:text-muted",
    error ? "border-danger border-2" : "border-line-strong",
  );

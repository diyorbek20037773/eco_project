"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Button";
import { IconChevronRight } from "@/components/ui/icons";

/** Rol kartasi tugmasi: yuborilayotganda takroriy bosish bloklanadi va spinner ko‘rinadi. */
export function EnterButton({ title, subtitle, cta }: { title: string; subtitle: string; cta: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-kraft-line bg-kraft px-4 py-3 text-left hover:bg-kraft-soft disabled:opacity-70"
    >
      <span className="min-w-0">
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-muted">{subtitle}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">
        {pending ? <Spinner /> : null}
        {cta}
        <IconChevronRight size={18} />
      </span>
    </button>
  );
}

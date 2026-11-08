import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Mobil pastki yopishqoq tugma joyi (bir qo‘lda ishlatish uchun). Telefon "safe-area"ni hisobga oladi.
 * Sahifa pastida `pb-28` qoldiring, kontent tugma ostida qolmasin.
 */
export function StickyActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 px-4 pt-3 backdrop-blur",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-2">{children}</div>
    </div>
  );
}

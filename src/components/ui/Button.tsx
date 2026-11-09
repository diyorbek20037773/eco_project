import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";
import { UiText } from "./UiText";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "kraft" | "mint";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover border border-primary",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-primary-soft",
  danger: "bg-surface text-danger border border-danger hover:bg-danger-soft",
  ghost: "bg-transparent text-primary border border-transparent hover:bg-primary-soft underline-offset-2",
  kraft: "bg-kraft text-ink border border-kraft-line hover:bg-kraft-soft",
  mint: "bg-mint text-ink font-bold border border-mint hover:bg-mint-hover",
};

// Barcha o‘lchamlar ≥ 44px bosish maydoni.
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-14 px-5 text-lg",
  xl: "min-h-16 px-6 text-xl",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", block = false) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-center leading-tight transition-colors",
    "disabled:opacity-60 aria-disabled:opacity-60",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
  );
}

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  loadingText,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClasses(variant, size, block), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      <span>{loading ? (loadingText ?? <UiText k="sending" />) : children}</span>
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  external?: boolean;
}

export function LinkButton({ href, variant = "primary", size = "md", block, icon, className, children, external, ...rest }: LinkButtonProps) {
  const cls = cx(buttonClasses(variant, size, block), className);
  if (external || href.startsWith("tel:") || href.startsWith("http")) {
    return (
      <a href={href} className={cls} {...rest}>
        {icon}
        <span>{children}</span>
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

/** Oddiy matnli havola, ≥44px bosish maydoni bilan. */
export function TextLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx("inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:text-primary-hover", className)}
    >
      {children}
    </Link>
  );
}

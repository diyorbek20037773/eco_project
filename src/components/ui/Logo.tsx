import { cx } from "./cx";

/** Eco Point belgisi: karton quti (kvadrat), buklama chiziqlari va kichik barg. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect x="3" y="7" width="24" height="22" rx="3" fill="#EAD8BC" stroke="#17392E" strokeWidth="2" />
      {/* qopqoq buklamalari */}
      <path d="M3 13h24" stroke="#17392E" strokeWidth="1.6" />
      <path d="M15 7v6" stroke="#17392E" strokeWidth="1.6" />
      <path d="M3 13 9 7M27 13l-6-6" stroke="#17392E" strokeWidth="1.2" strokeDasharray="2 2" />
      {/* barg */}
      <path d="M17 26c0-6 4-9 11-9-0.5 6.5-4 9.5-11 9z" fill="#176947" />
      <path d="M18.5 24.5c2.5-2.5 4.8-3.8 7-4.6" stroke="#F7F7F2" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-bold text-ink", className)}>
      <LogoMark size={size} />
      <span className="whitespace-nowrap text-lg leading-none tracking-tight">Eco Point</span>
    </span>
  );
}

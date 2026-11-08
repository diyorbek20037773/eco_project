import { cx } from "./cx";

/** Eco Point belgisi: yashil izometrik karton quti; ustki yuzada qopqoq buklama chizig‘i. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      {/* ustki yuz */}
      <path d="M16 2.5 28.5 9 16 15.5 3.5 9z" fill="#5BE59A" />
      {/* chap yuz */}
      <path d="M3.5 9 16 15.5V30L3.5 23.5z" fill="#2ED47A" />
      {/* o‘ng yuz */}
      <path d="M28.5 9 16 15.5V30l12.5-6.5z" fill="#1FA85E" />
      {/* qopqoq buklamasi (karton chizig‘i) */}
      <path d="M9.75 5.75 22.25 12.25" stroke="#17392E" strokeOpacity=".35" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M16 15.5V30" stroke="#17392E" strokeOpacity=".18" strokeWidth=".8" />
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

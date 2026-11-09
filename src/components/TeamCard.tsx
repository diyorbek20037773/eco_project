import type { Dict } from "@/i18n/dictionaries";
import { cx } from "@/components/ui/cx";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Loyiha jamoasi: Qarshi davlat universiteti talabalari. */
export function TeamCard({ team, className, compact = false }: { team: Dict["team"]; className?: string; compact?: boolean }) {
  return (
    <section aria-labelledby="team-title" className={cx("rounded-2xl border border-line bg-surface p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="team-title" className="text-lg font-bold">
          {team.title}
        </h2>
        <p className="text-sm text-muted">{team.subtitle}</p>
      </div>
      <ul className={cx("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4")}>
        {team.members.map((m, i) => (
          <li key={m.name} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <span
              aria-hidden="true"
              className={cx(
                "flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-ink",
                i === 0 ? "bg-mint" : "bg-mint-soft",
              )}
            >
              {initials(m.name)}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{m.name}</span>
              <span className="block text-sm text-muted">{m.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

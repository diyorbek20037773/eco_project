import type { Role } from "@/server/contract";
import { enterAsAction } from "@/server/actions/auth";
import { DEMO_USERS } from "@/server/demo";
import { uzText } from "@/domain/labels";
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/dictionaries";
import { labelsFor } from "@/i18n/labels";
import { IconBox, IconStore, IconTruck } from "@/components/ui/icons";
import { EnterButton } from "./EnterButton";

const ORDER: Role[] = ["SHOP", "COLLECTOR", "OPERATOR"];
const ICON: Record<Role, React.ReactNode> = {
  SHOP: <IconStore size={22} />,
  COLLECTOR: <IconTruck size={22} />,
  OPERATOR: <IconBox size={22} />,
};

/** "Do‘kon xodimi — Bahor savdo (boshqa do‘kon)" → "Bahor savdo" */
function displayName(label: string): string {
  const parts = uzText(label).split(" — ");
  const name = parts.length > 1 ? parts.slice(1).join(" — ") : parts[0] ?? "";
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}

/** Ochiq kirish: rolni tanlang — parolsiz darhol kiriladi. */
export function RolePicker({ locale, t, error }: { locale: Locale; t: Dict["login"]; error: boolean }) {
  const L = labelsFor(locale);
  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-xl border border-danger/50 bg-danger-soft px-3 py-2 font-semibold text-danger">
          {t.openError}
        </p>
      ) : null}
      {ORDER.map((role) => (
        <section key={role} aria-labelledby={`role-${role}`} className="space-y-2">
          <h2 id={`role-${role}`} className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true" className="text-primary">
              {ICON[role]}
            </span>
            {L.role[role]}
          </h2>
          <ul className="grid gap-2">
            {DEMO_USERS.filter((u) => u.role === role).map((u) => (
              <li key={u.login}>
                <form action={enterAsAction}>
                  <input type="hidden" name="login" value={u.login} />
                  <EnterButton title={displayName(u.label)} subtitle={L.role[role]} cta={t.submit} />
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

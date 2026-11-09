"use client";

import { useActionState, useRef, useState } from "react";
import type { DemoAccount, LoginState } from "@/server/contract";
import { loginAction } from "@/server/actions/auth";
import { uzText } from "@/domain/labels";
import type { Dict } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { Card } from "@/components/ui/Card";

const initialState: LoginState = {};
type Tl = Dict["login"];

/** Server xabarlari o‘zbekcha keladi — ma’lumlarini tanlangan tilga o‘giramiz. */
function localizeError(error: string, t: Tl): string {
  const map: Record<string, string> = {
    "Login va parolni kiriting.": t.errMissing,
    "Login yoki parol noto‘g‘ri.": t.errWrong,
    "Akkaunt o‘chirilgan. Operatorga murojaat qiling.": t.errDisabled,
    "Demo akkauntlar ishlab chiqarish rejimida ishlamaydi.": t.errDemoProd,
    "Kutilmagan xato. Qayta urinib ko‘ring.": t.errUnexpected,
  };
  return map[error] ?? uzText(error);
}

/** "Do‘kon xodimi — Nur market" → nom qismi ("Nur market"); rol tarjimasi alohida. */
function accountName(label: string): string {
  const parts = uzText(label).split(" — ");
  return parts.length > 1 ? parts.slice(1).join(" — ") : uzText(label);
}

export function LoginForm({ demoAccounts, t }: { demoAccounts: DemoAccount[]; t: Tl }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const roleLabel = (r: DemoAccount["role"]) => t[`role${r}`];

  function pick(acc: DemoAccount) {
    setLogin(acc.login);
    setPassword(acc.password);
    setPicked(acc.login);
    submitRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4" noValidate>
        <TextInput
          label={t.login}
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <TextInput
          label={t.password}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div aria-live="polite">
          {state.error ? (
            <Notice tone="danger" title={t.failed}>
              {localizeError(state.error, t)}
            </Notice>
          ) : null}
        </div>
        <Button ref={submitRef} type="submit" size="lg" block loading={pending} loadingText={t.checking}>
          {t.submit}
        </Button>
      </form>

      {demoAccounts.length > 0 ? (
        <section aria-labelledby="demo-title" className="space-y-2">
          <h2 id="demo-title" className="text-lg font-bold">
            {t.demoTitle}
          </h2>
          <p className="text-sm text-muted">{t.demoHint}</p>
          <ul className="grid gap-2">
            {demoAccounts.map((acc) => (
              <li key={acc.login}>
                <button type="button" onClick={() => pick(acc)} aria-pressed={picked === acc.login} className="block w-full text-left">
                  <Card tone={picked === acc.login ? "primary" : "kraft"} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {roleLabel(acc.role)} — {accountName(acc.label)}
                      </span>
                      <span className="block text-sm text-muted">
                        login: <span className="font-mono">{acc.login}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-primary">{picked === acc.login ? t.picked : t.pick}</span>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

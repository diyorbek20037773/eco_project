"use client";

import { useActionState, useRef, useState } from "react";
import type { DemoAccount, LoginState } from "@/server/contract";
import { loginAction } from "@/server/actions/auth";
import { ROLE_LABEL, uzText } from "@/domain/labels";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { Card } from "@/components/ui/Card";

const initialState: LoginState = {};

export function LoginForm({ demoAccounts }: { demoAccounts: DemoAccount[] }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

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
          label="Login"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <TextInput
          label="Parol"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div aria-live="polite">
          {state.error ? (
            <Notice tone="danger" title="Kirib bo‘lmadi">
              {uzText(state.error)}
            </Notice>
          ) : null}
        </div>
        <Button ref={submitRef} type="submit" size="lg" block loading={pending} loadingText="Tekshirilmoqda…">
          Kirish
        </Button>
      </form>

      {demoAccounts.length > 0 ? (
        <section aria-labelledby="demo-title" className="space-y-2">
          <h2 id="demo-title" className="text-lg font-bold">
            Demo akkauntlar
          </h2>
          <p className="text-sm text-muted">Kartani bosing — login va parol to‘ldiriladi, keyin «Kirish»ni bosing.</p>
          <ul className="grid gap-2">
            {demoAccounts.map((acc) => (
              <li key={acc.login}>
                <button
                  type="button"
                  onClick={() => pick(acc)}
                  aria-pressed={picked === acc.login}
                  className="block w-full text-left"
                >
                  <Card
                    tone={picked === acc.login ? "primary" : "kraft"}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{uzText(acc.label)}</span>
                      <span className="block text-sm text-muted">
                        {ROLE_LABEL[acc.role]} · login: <span className="font-mono">{acc.login}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {picked === acc.login ? "Tanlandi ✓" : "Tanlash"}
                    </span>
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

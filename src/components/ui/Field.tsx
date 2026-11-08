"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { inputClasses } from "./styles";


interface ShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
}

function useFieldIds(id?: string) {
  const auto = useId();
  const base = id ?? auto;
  return { id: base, hintId: `${base}-hint`, errorId: `${base}-error` };
}

function describedBy(hint: unknown, error: unknown, ids: { hintId: string; errorId: string }) {
  const parts = [hint ? ids.hintId : null, error ? ids.errorId : null].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function Label({ htmlFor, children, required, optional }: { htmlFor: string; children: ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-ink">
      {children}
      {required ? <span className="text-danger"> *</span> : null}
      {optional ? <span className="font-normal text-muted"> (ixtiyoriy)</span> : null}
    </label>
  );
}

function Messages({ hint, error, ids }: { hint?: ReactNode; error?: string | null; ids: { hintId: string; errorId: string } }) {
  return (
    <>
      {hint ? (
        <p id={ids.hintId} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={ids.errorId} className="mt-1 flex items-start gap-1 text-sm font-semibold text-danger">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </>
  );
}


export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, ShellProps {
  suffix?: string;
  inputClassName?: string;
}

export function TextInput({ label, hint, error, required, optional, className, suffix, inputClassName, id, ...rest }: TextInputProps) {
  const ids = useFieldIds(id);
  return (
    <div className={cx("min-w-0", className)}>
      <Label htmlFor={ids.id} required={required} optional={optional}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={ids.id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, ids)}
          className={cx(inputClasses(error), suffix && "pr-16", inputClassName)}
          {...rest}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-base font-semibold text-muted"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      <Messages hint={hint} error={error} ids={ids} />
    </div>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, ShellProps {
  children: ReactNode;
}

export function Select({ label, hint, error, required, optional, className, id, children, ...rest }: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <div className={cx("min-w-0", className)}>
      <Label htmlFor={ids.id} required={required} optional={optional}>
        {label}
      </Label>
      <select
        id={ids.id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={cx(inputClasses(error), "pr-8")}
        {...rest}
      >
        {children}
      </select>
      <Messages hint={hint} error={error} ids={ids} />
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, ShellProps {}

export function Textarea({ label, hint, error, required, optional, className, id, rows = 3, ...rest }: TextareaProps) {
  const ids = useFieldIds(id);
  return (
    <div className={cx("min-w-0", className)}>
      <Label htmlFor={ids.id} required={required} optional={optional}>
        {label}
      </Label>
      <textarea
        id={ids.id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={inputClasses(error)}
        {...rest}
      />
      <Messages hint={hint} error={error} ids={ids} />
    </div>
  );
}

/** "12,5" ko‘rinishidagi kiritish: faqat raqam va bitta ajratgich (vergul yoki nuqta). */
export function sanitizeKg(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const sep = s.search(/[.,]/);
  if (sep >= 0) s = s.slice(0, sep + 1) + s.slice(sep + 1).replace(/[.,]/g, "");
  return s;
}

/** "1250000" → "1 250 000" (input ichida oddiy bo‘shliq). */
export function sanitizeSom(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export interface KgInputProps extends Omit<TextInputProps, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Vazn: mobil raqam klaviaturasi (decimal), ko‘rinadigan «kg» birligi, «,» va «.» qabul qilinadi. */
export function KgInput({ value, onValueChange, placeholder = "0,0", ...rest }: KgInputProps) {
  return (
    <TextInput
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="next"
      suffix="kg"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(sanitizeKg(e.target.value))}
      inputClassName="text-lg font-semibold"
      {...rest}
    />
  );
}

export interface SomInputProps extends Omit<TextInputProps, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Pul: butun so‘m, raqam klaviaturasi, ko‘rinadigan «so‘m» birligi. */
export function SomInput({ value, onValueChange, placeholder = "0", ...rest }: SomInputProps) {
  return (
    <TextInput
      type="text"
      inputMode="numeric"
      autoComplete="off"
      suffix="so‘m"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(sanitizeSom(e.target.value))}
      inputClassName="font-semibold"
      {...rest}
    />
  );
}

export interface ChoiceOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
}

/** Radio guruh kartalar ko‘rinishida (≥ 44px). */
export function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  columns = 1,
  required,
}: {
  legend: ReactNode;
  name: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  columns?: 1 | 2 | 3;
  required?: boolean;
}) {
  const ids = useFieldIds();
  const grid = columns === 3 ? "grid-cols-1 sm:grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <fieldset className="min-w-0" aria-describedby={describedBy(hint, error, ids)}>
      <legend className="mb-1 text-sm font-semibold text-ink">
        {legend}
        {required ? <span className="text-danger"> *</span> : null}
      </legend>
      <div className={cx("grid gap-2", grid)}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cx(
                "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "border-primary border-2 bg-primary-soft" : "border-line-strong bg-surface",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="mt-1 size-5 shrink-0 accent-[#176947]"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{o.label}</span>
                {o.description ? <span className="block text-sm text-muted">{o.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      <Messages hint={hint} error={error} ids={ids} />
    </fieldset>
  );
}

/** Tezkor tanlov tugmalari (masalan «Bugun», «09–12»). aria-pressed bilan. */
export function QuickChips({
  label,
  options,
  isActive,
  onPick,
}: {
  label: string;
  options: { key: string; label: string }[];
  isActive: (key: string) => boolean;
  onPick: (key: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = isActive(o.key);
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(o.key)}
            className={cx(
              "min-h-11 rounded-full border px-4 text-sm font-semibold tabular-nums",
              active ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink hover:bg-primary-soft",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
}) {
  const ids = useFieldIds();
  return (
    <div>
      <label htmlFor={ids.id} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          id={ids.id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={hint ? ids.hintId : undefined}
          className="size-5 shrink-0 accent-[#176947]"
        />
        <span className="font-semibold">{label}</span>
      </label>
      {hint ? (
        <p id={ids.hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

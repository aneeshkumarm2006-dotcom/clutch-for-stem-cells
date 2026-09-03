"use client";

/**
 * Shared calculator primitives.
 *
 * Eleven calculators with one look and one set of keyboard and screen-reader
 * behaviours, rather than eleven variations that drifted apart. Everything here
 * is presentational and controlled: no calculator owns its own styling, and no
 * primitive owns state.
 *
 * Two behaviours worth knowing because every tool depends on them:
 *
 *  - Results are wrapped in `aria-live="polite"`. These calculators update as
 *    you type rather than behind a Calculate button, which is better for
 *    everyone with a screen and silent for everyone without one unless the
 *    result region announces itself.
 *  - `NumberField` keeps its own string state. A controlled number input that
 *    reformats mid-keystroke fights the person typing into it: clearing the
 *    field to retype becomes impossible when the empty string is coerced to 0.
 *    The string is local, the number is what the parent gets.
 */
import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// ── Layout ──────────────────────────────────────────────────────────────────

/** The bordered panel a calculator lives in. */
export function ToolPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-card md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A titled group of inputs inside a panel. */
export function ToolSection({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title ? (
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            {title}
          </h3>
          {hint ? (
            <p className="mt-1 text-[12.5px] text-text-muted">{hint}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Two-up on wider screens, stacked on mobile. */
export function ToolGrid({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Number input ────────────────────────────────────────────────────────────

export interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Unit shown inside the field's right edge. */
  suffix?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Rendered instead of a hint when the value is unusable. */
  error?: string;
  className?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  min,
  max,
  step,
  placeholder,
  error,
  className,
}: NumberFieldProps) {
  const id = React.useId();
  const [text, setText] = React.useState(
    value === undefined ? "" : String(value),
  );

  // Follow the parent when it changes the value itself (a unit toggle
  // converting kg to lb, a preset being applied), but never while the field is
  // focused, which would rewrite what somebody is halfway through typing.
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (focused.current) return;
    setText(value === undefined ? "" : String(value));
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-text-secondary"
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step ?? "any"}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cn(suffix && "pr-12")}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
          }}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            if (next.trim() === "") {
              onChange(undefined);
              return;
            }
            const parsed = Number(next);
            onChange(Number.isFinite(parsed) ? parsed : undefined);
          }}
        />
        {suffix ? (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-medium text-text-muted"
            aria-hidden="true"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {error || hint ? (
        <p
          id={`${id}-msg`}
          className={cn(
            "text-[12.5px] leading-snug",
            error ? "text-danger" : "text-text-muted",
          )}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

// ── Segmented control ───────────────────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A small set of mutually exclusive choices, rendered as a segmented control.
 *
 * Radios under the styling rather than buttons, so arrow keys move between
 * options and the group announces as one control.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const name = React.useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1.5 text-[13px] font-medium text-text-secondary">
        {label}
      </legend>
      <div className="inline-flex w-full rounded-md border border-border bg-surface-alt p-0.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex-1 cursor-pointer rounded-[7px] px-3 text-center font-medium transition-colors",
                size === "sm"
                  ? "py-1 text-[12.5px]"
                  : "py-1.5 text-[13px]",
                active
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={active}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── Choice list ─────────────────────────────────────────────────────────────

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** A stacked radio list, for choices too long to sit in a segmented control. */
export function ChoiceList<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = React.useId();
  return (
    <fieldset className={className}>
      <legend className="text-[14px] font-semibold text-text-primary">
        {label}
      </legend>
      {hint ? (
        <p className="mb-2 mt-1 text-[12.5px] text-text-muted">{hint}</p>
      ) : (
        <div className="h-2" />
      )}
      <div className="space-y-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
                active
                  ? "border-primary bg-tint"
                  : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={active}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] leading-snug text-text-primary">
                  {opt.label}
                </span>
                {opt.hint ? (
                  <span className="mt-0.5 block text-[12px] text-text-muted">
                    {opt.hint}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── Likert row ──────────────────────────────────────────────────────────────

/**
 * One questionnaire item as a row of radio buttons.
 *
 * The scale labels are printed once as a header above the group rather than
 * repeated on all 24 rows, so each radio carries an `aria-label` naming both the
 * item and the option. Without it a screen reader reads twenty-four identical
 * groups of "None, Mild, Moderate" with nothing to say which item is which.
 */
export function LikertRow({
  itemLabel,
  scale,
  value,
  onChange,
  index,
}: {
  itemLabel: string;
  scale: string[];
  value: number | undefined;
  onChange: (value: number) => void;
  index: number;
}) {
  const name = React.useId();
  return (
    <fieldset
      className={cn(
        "grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center",
        index % 2 === 1 && "bg-surface-alt",
      )}
    >
      <legend className="sr-only">{itemLabel}</legend>
      <span className="text-[13.5px] leading-snug text-text-primary">
        {itemLabel}
      </span>
      <div className="flex gap-1">
        {scale.map((option, i) => {
          const active = value === i;
          return (
            <label
              key={option}
              title={option}
              className={cn(
                "flex h-8 min-w-8 flex-1 cursor-pointer items-center justify-center rounded-md border text-[12px] font-medium transition-colors sm:w-10 sm:flex-none",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-text-muted hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name={name}
                checked={active}
                onChange={() => onChange(i)}
                aria-label={`${itemLabel}: ${option}`}
                className="sr-only"
              />
              <span aria-hidden="true" className="sm:hidden">
                {option}
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                {i}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The legend printed once above a set of `LikertRow`s. */
export function LikertScaleKey({ scale }: { scale: string[] }) {
  return (
    <p className="px-3 pb-2 text-[12px] text-text-muted">
      {scale.map((label, i) => (
        <span key={label} className="mr-3 inline-block whitespace-nowrap">
          <span className="font-semibold text-text-secondary">{i}</span>{" "}
          {label}
        </span>
      ))}
    </p>
  );
}

// ── Results ─────────────────────────────────────────────────────────────────

/**
 * The result region. Announced politely, because results update as you type.
 */
export function ResultPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-xl border border-azure-200 bg-azure-50 p-5 md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The headline figure, with its unit and caption. */
export function ResultHeadline({
  value,
  unit,
  label,
  sub,
}: {
  value: string;
  unit?: string;
  label: string;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-azure-700">
        {label}
      </p>
      <p className="mt-1 font-display text-[38px] font-bold leading-none tracking-[-0.02em] text-text-primary md:text-[44px]">
        {value}
        {unit ? (
          <span className="ml-1.5 text-[18px] font-semibold text-text-secondary md:text-[20px]">
            {unit}
          </span>
        ) : null}
      </p>
      {sub ? (
        <div className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/** A secondary figure sitting beside or under the headline. */
export function ResultStat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3.5 py-3">
      <p className="text-[12px] font-medium text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display font-semibold tracking-[-0.01em] text-text-primary",
          emphasis ? "text-[22px]" : "text-[18px]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[12px] leading-snug text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** A row of `ResultStat`s. */
export function ResultStats({
  children,
  cols = 3,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "mt-4 grid gap-2.5",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "grid-cols-2 sm:grid-cols-3",
        cols === 4 && "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

export interface ScaleSegment {
  label: string;
  /** Inclusive lower bound on the axis. */
  min: number;
  /** Exclusive upper bound; use the axis maximum for the last segment. */
  max: number;
}

/**
 * A banded scale with a marker at the current value.
 *
 * Bands are drawn proportionally to their real width on the axis, so the
 * picture does not misrepresent how wide "healthy" is next to "overweight". The
 * marker is decorative: the same information is in the text above it, and a
 * screen reader gets that rather than a positioned dot.
 */
export function ScaleBar({
  segments,
  value,
  axisMin,
  axisMax,
  activeLabel,
}: {
  segments: ScaleSegment[];
  value: number;
  axisMin: number;
  axisMax: number;
  activeLabel?: string;
}) {
  const span = Math.max(axisMax - axisMin, 1);
  const pct = Math.min(
    100,
    Math.max(0, ((value - axisMin) / span) * 100),
  );

  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {segments.map((seg, i) => {
            const width =
              ((Math.min(seg.max, axisMax) - Math.max(seg.min, axisMin)) /
                span) *
              100;
            const active = seg.label === activeLabel;
            return (
              <div
                key={seg.label}
                style={{ width: `${Math.max(width, 0)}%` }}
                className={cn(
                  "h-full transition-colors",
                  active ? "bg-primary" : "bg-azure-200",
                  i > 0 && "border-l border-white/70",
                )}
              />
            );
          })}
        </div>
        <div
          className="absolute -top-1 size-4.5 -translate-x-1/2 rounded-full border-[3px] border-primary bg-surface shadow-sm"
          style={{ left: `${pct}%`, height: 18, width: 18 }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-text-muted">
        <span>{axisMin}</span>
        <span>{axisMax}</span>
      </div>
    </div>
  );
}

/** A label / value list, for cost breakdowns and working-out lists. */
export function Breakdown({
  rows,
  total,
}: {
  rows: { key: string; label: string; value: string; detail?: string }[];
  total?: { label: string; value: string };
}) {
  return (
    <dl className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-baseline justify-between gap-4 px-3.5 py-2.5"
        >
          <dt className="min-w-0 text-[13px] text-text-secondary">
            {row.label}
            {row.detail ? (
              <span className="block text-[11.5px] text-text-muted">
                {row.detail}
              </span>
            ) : null}
          </dt>
          <dd className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
            {row.value}
          </dd>
        </div>
      ))}
      {total ? (
        <div className="flex items-baseline justify-between gap-4 bg-surface-alt px-3.5 py-3">
          <dt className="text-[13px] font-semibold text-text-primary">
            {total.label}
          </dt>
          <dd className="font-display text-[18px] font-bold tabular-nums text-text-primary">
            {total.value}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/** A short caveat under a result. */
export function ToolNote({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "warning";
}) {
  return (
    <p
      className={cn(
        "mt-3 rounded-md px-3 py-2 text-[12.5px] leading-relaxed",
        tone === "warning"
          ? "bg-warning-bg text-warning-fg"
          : "bg-surface-alt text-text-secondary",
      )}
    >
      {children}
    </p>
  );
}

/** Progress through a long questionnaire. */
export function AnsweredMeter({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-azure-100">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-[12px] font-medium tabular-nums text-text-muted">
        {answered} of {total}
      </span>
    </div>
  );
}

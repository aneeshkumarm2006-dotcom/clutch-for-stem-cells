"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Form primitives — Design §10.2. Composes the themed `Input` / `Textarea` /
 * `Select` with the standard label, leading-icon, hint and error patterns:
 *
 * - **Label**: body-sm / 500, `text-secondary`, 6px above the field.
 * - **Leading icon**: `neutral-500` at 18px, 12px inset, control `padding-left 38px`.
 * - **Error**: control border `danger` + helper text in `danger`; hint text is
 *   `meta`-sized `text-muted`. Error replaces the hint and wires `aria-describedby`.
 *
 * `TextField` / `TextareaField` / `SelectField` cover the common cases; `Field`
 * is the low-level label+message wrapper (render-prop) for custom controls.
 */

// ── Label ────────────────────────────────────────────────────────────────────

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-[13px] font-medium text-text-secondary", className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  ),
);
Label.displayName = "Label";

// ── Message (hint / error) ───────────────────────────────────────────────────

export function FieldMessage({
  id,
  error,
  hint,
  className,
}: {
  id?: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  if (!error && !hint) return null;
  return (
    <p
      id={id}
      className={cn(
        "text-[12.5px] leading-snug",
        error ? "text-danger" : "text-text-muted",
        className,
      )}
    >
      {error ?? hint}
    </p>
  );
}

// ── Low-level wrapper (render-prop) ──────────────────────────────────────────

interface FieldControlState {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  /** Node aligned to the right of the label (e.g. a "Forgot password?" link). */
  labelAccessory?: React.ReactNode;
  /** Supply to control the id; otherwise an auto id is generated. */
  id?: string;
  className?: string;
  children: (control: FieldControlState) => React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  labelAccessory,
  id,
  className,
  children,
}: FieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const messageId = error || hint ? `${fieldId}-msg` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={fieldId} required={required}>
            {label}
          </Label>
          {labelAccessory}
        </div>
      ) : null}
      {children({
        id: fieldId,
        "aria-describedby": messageId,
        "aria-invalid": error ? true : undefined,
      })}
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

// ── Leading-icon wrapper ─────────────────────────────────────────────────────

function IconWrap({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  if (!Icon) return <>{children}</>;
  return (
    <div className="relative">
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-500"
      />
      {children}
    </div>
  );
}

// ── TextField ────────────────────────────────────────────────────────────────

export interface TextFieldProps extends Omit<
  React.ComponentProps<"input">,
  "id"
> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  labelAccessory?: React.ReactNode;
  leadingIcon?: LucideIcon;
  id?: string;
  /** Class on the outer wrapper (the field group). */
  wrapperClassName?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      hint,
      error,
      required,
      labelAccessory,
      leadingIcon,
      id,
      className,
      wrapperClassName,
      ...props
    },
    ref,
  ) => (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelAccessory={labelAccessory}
      id={id}
      className={wrapperClassName}
    >
      {(control) => (
        <IconWrap icon={leadingIcon}>
          <Input
            ref={ref}
            className={cn(leadingIcon && "pl-[38px]", className)}
            {...control}
            {...props}
          />
        </IconWrap>
      )}
    </Field>
  ),
);
TextField.displayName = "TextField";

// ── TextareaField ────────────────────────────────────────────────────────────

export interface TextareaFieldProps extends Omit<
  React.ComponentProps<"textarea">,
  "id"
> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  labelAccessory?: React.ReactNode;
  id?: string;
  wrapperClassName?: string;
}

export const TextareaField = React.forwardRef<
  HTMLTextAreaElement,
  TextareaFieldProps
>(
  (
    {
      label,
      hint,
      error,
      required,
      labelAccessory,
      id,
      className,
      wrapperClassName,
      ...props
    },
    ref,
  ) => (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelAccessory={labelAccessory}
      id={id}
      className={wrapperClassName}
    >
      {(control) => (
        <Textarea ref={ref} className={className} {...control} {...props} />
      )}
    </Field>
  ),
);
TextareaField.displayName = "TextareaField";

// ── SelectField ──────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  labelAccessory?: React.ReactNode;
  id?: string;
  wrapperClassName?: string;
  className?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

export function SelectField({
  label,
  hint,
  error,
  required,
  labelAccessory,
  id,
  wrapperClassName,
  className,
  placeholder,
  options,
  value,
  defaultValue,
  name,
  disabled,
  onValueChange,
}: SelectFieldProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelAccessory={labelAccessory}
      id={id}
      className={wrapperClassName}
    >
      {(control) => (
        <Select
          value={value}
          defaultValue={defaultValue}
          name={name}
          disabled={disabled}
          onValueChange={onValueChange}
        >
          <SelectTrigger
            id={control.id}
            aria-describedby={control["aria-describedby"]}
            aria-invalid={control["aria-invalid"]}
            className={cn(
              control["aria-invalid"] && "border-danger",
              className,
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

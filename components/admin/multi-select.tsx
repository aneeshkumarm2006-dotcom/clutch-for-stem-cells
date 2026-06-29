"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MultiOption {
  value: string;
  label: string;
}

/**
 * Multi-select over a fixed option set (clinic taxonomy assignment).
 *  - `chips`: selected shown as removable chips + an "Add" dropdown of the rest
 *    (good for long lists like treatments/conditions).
 *  - `pills`: every option is a toggle pill (good for small sets like cell sources).
 */
export function MultiSelect({
  value,
  onChange,
  options,
  variant = "chips",
  addLabel = "Add",
  emptyLabel = "None selected yet.",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiOption[];
  variant?: "chips" | "pills";
  addLabel?: string;
  emptyLabel?: string;
}) {
  const selected = new Set(value);
  const labelFor = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  // Remount the Add-select after each pick so it resets to the placeholder.
  const [pickerKey, setPickerKey] = React.useState(0);

  if (variant === "pills") {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                onChange(
                  on
                    ? value.filter((v) => v !== o.value)
                    : [...value, o.value],
                )
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[13px]",
                on
                  ? "border-azure-300 bg-tint font-semibold text-azure-700"
                  : "border-border text-text-secondary hover:border-border-strong",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-[15px] items-center justify-center rounded",
                  on ? "bg-primary text-white" : "border-[1.5px] border-border-strong",
                )}
              >
                {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  const available = options.filter((o) => !selected.has(o.value));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.length === 0 ? (
        <span className="text-[13px] text-text-muted">{emptyLabel}</span>
      ) : null}
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1.5 rounded-sm border border-azure-300 bg-tint py-1 pl-2.5 pr-1.5 text-[12.5px] font-semibold text-azure-700"
        >
          {labelFor(v)}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            aria-label={`Remove ${labelFor(v)}`}
            className="text-azure-700/70 hover:text-azure-700"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {available.length > 0 ? (
        <Select
          key={pickerKey}
          onValueChange={(v) => {
            onChange([...value, v]);
            setPickerKey((k) => k + 1);
          }}
        >
          <SelectTrigger className="h-8 w-auto gap-1.5 border-dashed text-[12.5px] text-text-secondary">
            <Plus className="size-3" />
            <SelectValue placeholder={addLabel} />
          </SelectTrigger>
          <SelectContent>
            {available.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

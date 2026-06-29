"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tag/chip input (Admin settings & blog mockups) — a removable-chip editor for
 * free-text string arrays: popular searches, languages, highlights, tags.
 * Enter or comma commits; Backspace on an empty field removes the last chip.
 */
export interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Reject duplicates (case-insensitive). Default true. */
  unique?: boolean;
  maxTags?: number;
  id?: string;
  "aria-describedby"?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Add and press Enter",
  unique = true,
  maxTags,
  id,
  className,
  ...aria
}: TagInputProps) {
  const [draft, setDraft] = React.useState("");

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (maxTags && value.length >= maxTags) return;
    if (unique && value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const removeAt = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i));

  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-1.5 focus-within:border-primary",
        className,
      )}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-sm bg-tint py-0.5 pl-2 pr-1 text-[12.5px] font-medium text-azure-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="rounded-sm p-0.5 text-azure-700/70 hover:text-azure-700"
            aria-label={`Remove ${tag}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            removeAt(value.length - 1);
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent px-1.5 py-1 text-sm text-text-primary outline-none placeholder:text-text-muted"
        {...aria}
      />
    </div>
  );
}

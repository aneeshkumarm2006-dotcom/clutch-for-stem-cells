"use client";

import * as React from "react";
import { Bold, Italic, Heading2, Heading3, List, Link2, Eye, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Markdown body editor (PRD §8.6) — a toolbar that wraps/inserts Markdown around
 * the selection, with a live preview tab rendered via the same `renderMarkdown`
 * the public article page uses. Pragmatic alternative to a heavy WYSIWYG/MDX
 * dependency; output renders identically on the public site.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = React.useState<"write" | "preview">("write");

  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const selected = v.slice(s, e) || "text";
    const next = v.slice(0, s) + before + selected + after + v.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = s + before.length;
      el.selectionEnd = s + before.length + selected.length;
    });
  };

  const prefixLine = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, value: v } = el;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    onChange(v.slice(0, lineStart) + prefix + v.slice(lineStart));
    requestAnimationFrame(() => el.focus());
  };

  const tools = [
    { icon: Bold, label: "Bold", action: () => wrap("**") },
    { icon: Italic, label: "Italic", action: () => wrap("*") },
    { icon: Heading2, label: "Heading 2", action: () => prefixLine("## ") },
    { icon: Heading3, label: "Heading 3", action: () => prefixLine("### ") },
    { icon: List, label: "List item", action: () => prefixLine("- ") },
    { icon: Link2, label: "Link", action: () => wrap("[", "](https://)") },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-1 border-b border-slate-100 bg-surface-alt px-2 py-1.5">
        {tab === "write"
          ? tools.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={t.action}
                title={t.label}
                aria-label={t.label}
                className="rounded-md p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary"
              >
                <t.icon className="size-4" />
              </button>
            ))
          : null}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium",
              tab === "write" ? "bg-surface text-text-primary shadow-xs" : "text-text-muted",
            )}
          >
            <Pencil className="size-3.5" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium",
              tab === "preview" ? "bg-surface text-text-primary shadow-xs" : "text-text-muted",
            )}
          >
            <Eye className="size-3.5" />
            Preview
          </button>
        </div>
      </div>
      {tab === "write" ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={18}
          className="block w-full resize-y bg-surface px-4 py-3 font-mono text-[13.5px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        />
      ) : (
        <div
          className="prose-article min-h-[300px] px-4 py-3"
          dangerouslySetInnerHTML={{
            __html: value.trim()
              ? renderMarkdown(value)
              : '<p class="text-text-muted">Nothing to preview yet.</p>',
          }}
        />
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import {
  ListChecks,
  ListOrdered,
  GitCompareArrows,
  Star,
  Newspaper,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { BLOG_TEMPLATE_LIST } from "@/lib/seoteam/templates";
import type { BlogTemplateKey } from "@/lib/enums";

const ICONS: Record<BlogTemplateKey, LucideIcon> = {
  "how-to": ListChecks,
  listicle: ListOrdered,
  comparison: GitCompareArrows,
  review: Star,
  news: Newspaper,
  generic: FileText,
};

/** Step 1 of the new-post flow: pick a template to pre-fill the editor. */
export function TemplatePicker({
  onSelect,
}: {
  onSelect: (key: BlogTemplateKey) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
          Pick a template
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Each one pre-fills a proven heading structure. You can edit everything.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BLOG_TEMPLATE_LIST.map((tpl) => {
          const Icon = ICONS[tpl.key];
          return (
            <button
              key={tpl.key}
              type="button"
              onClick={() => onSelect(tpl.key)}
              className="group flex flex-col items-start rounded-xl border border-border bg-surface p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-azure-200 hover:shadow-md"
            >
              <span className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-tint text-azure-700">
                <Icon className="size-5" />
              </span>
              <span className="font-display text-[15px] font-semibold text-text-primary group-hover:text-primary">
                {tpl.name}
              </span>
              <span className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                {tpl.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

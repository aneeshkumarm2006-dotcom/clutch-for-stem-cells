import * as React from "react";

import { renderMarkdown } from "@/lib/markdown";
import { EVIDENCE_LEVEL_LABELS, type EvidenceLevel } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { KeyFacts, type KeyFact } from "@/components/content/key-facts";
import { FaqSection, type FaqItem } from "@/components/content/faq-section";
import {
  ReviewedByByline,
  type ReviewerByline,
} from "@/components/content/reviewed-by-byline";
import type { BlockInput } from "@/lib/validation/block";

export interface EditorialArticleData {
  /** Long-form markdown body. */
  body?: string;
  /**
   * Editor-composed sections from the modular block builder. Optional so older
   * callers (and records saved before the builder existed) keep type-checking.
   */
  blocks?: BlockInput[];
  keyFacts: KeyFact[];
  /** Labeled per-kind markdown sections (rendered as h2 + prose). */
  sections: { title: string; body: string }[];
  faqs: FaqItem[];
  evidenceLevel?: EvidenceLevel | null;
  reviewer?: ReviewerByline | null;
  lastReviewedAt?: string | null;
  updatedAt?: string | null;
}

/** Neutral, non-promotional evidence-strength badge. */
function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-2.5 py-1 text-[12px] font-medium text-text-secondary">
      Evidence: {EVIDENCE_LEVEL_LABELS[level]}
    </span>
  );
}

function Markdown({ source }: { source: string }) {
  return (
    <div
      className="prose-article"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}

/**
 * Renders approved, human-reviewed editorial content: medical-reviewer byline →
 * evidence badge → key facts → long-form body → labeled sections → composed
 * blocks → scoped FAQ. Reused by taxonomy detail pages and combination pages.
 * Presentation only — the page emits FAQPage/MedicalWebPage JSON-LD from the
 * same data (see `lib/editorial-schema.ts`).
 *
 * The composed blocks sit last-but-one deliberately: the fixed per-kind fields
 * are the term's canonical facts, and the section builder is where an editor
 * expands on them. The FAQ stays at the bottom, where readers expect it.
 *
 * Renders nothing if there's no meaningful content (so a term with an empty but
 * approved record doesn't show an empty shell).
 */
export function EditorialArticle({
  data,
  className,
}: {
  data: EditorialArticleData;
  className?: string;
}) {
  const blocks = data.blocks ?? [];
  const hasContent =
    Boolean(data.body?.trim()) ||
    data.keyFacts.length > 0 ||
    data.sections.length > 0 ||
    blocks.length > 0 ||
    data.faqs.length > 0;
  if (!hasContent) return null;

  return (
    <div className={cn("space-y-8", className)}>
      {data.reviewer || data.evidenceLevel ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {data.evidenceLevel ? (
            <EvidenceBadge level={data.evidenceLevel} />
          ) : null}
          <ReviewedByByline
            reviewer={data.reviewer}
            lastReviewedAt={data.lastReviewedAt}
            updatedAt={data.updatedAt}
          />
        </div>
      ) : null}

      {data.keyFacts.length ? <KeyFacts facts={data.keyFacts} /> : null}

      {data.body?.trim() ? <Markdown source={data.body} /> : null}

      {data.sections.map((section) => (
        <section key={section.title}>
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {section.title}
          </h2>
          <div className="mt-3">
            <Markdown source={section.body} />
          </div>
        </section>
      ))}

      <BlockRenderer blocks={blocks} />

      <FaqSection items={data.faqs} />
    </div>
  );
}

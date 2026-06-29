import * as React from "react";

/**
 * ProsePage — shared layout for static/legal/trust pages (PRD §6.9). Centered
 * column with a title, optional lead paragraph, and a "Last updated" line.
 * Bodies become admin-editable in Stage 6.9; placeholders ship flagged for legal
 * review (Stage 10.3).
 */
export function ProsePage({
  title,
  lead,
  updated,
  legalReview,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  /** Show the "placeholder — flagged for legal review" note (PRD §14). */
  legalReview?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <header className="border-b border-border pb-6">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 text-[17px] leading-relaxed text-text-secondary">
            {lead}
          </p>
        ) : null}
        {updated ? (
          <p className="mt-3 text-[12.5px] text-text-muted">
            Last updated {updated}
          </p>
        ) : null}
      </header>

      {legalReview ? (
        <p className="mt-6 rounded-md bg-warning-bg px-4 py-3 text-[12.5px] leading-relaxed text-[#8A5A00]">
          This is placeholder content provided for product completeness and is
          flagged for review by a qualified professional before launch.
        </p>
      ) : null}

      <div className="prose-article mt-6">{children}</div>
    </div>
  );
}

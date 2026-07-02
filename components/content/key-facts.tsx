import * as React from "react";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export interface KeyFact {
  label: string;
  value: string;
  /** Visible primary-source citation (PubMed, clinicaltrials.gov, regulator). */
  sourceUrl?: string;
}

/** Short hostname for a source link, e.g. "pubmed.ncbi.nlm.nih.gov" → "pubmed". */
function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] || host;
  } catch {
    return "source";
  }
}

/**
 * A labeled facts table with visible source citations — the most extractable,
 * cite-friendly block for answer engines and a concrete E-E-A-T signal. External
 * source links are `nofollow`/`noopener` (we don't vouch for third parties).
 * Renders nothing when there are no facts.
 */
export function KeyFacts({
  facts,
  className,
}: {
  facts: KeyFact[];
  className?: string;
}) {
  if (!facts.length) return null;
  return (
    <dl
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface",
        className,
      )}
    >
      {facts.map((fact, i) => (
        <div
          key={`${fact.label}-${i}`}
          className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:gap-4"
        >
          <dt className="text-[13px] font-semibold text-text-primary">
            {fact.label}
          </dt>
          <dd className="text-[14px] text-text-secondary">
            {fact.value}
            {fact.sourceUrl ? (
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="ml-2 inline-flex items-center gap-0.5 text-[12px] text-text-link hover:underline"
              >
                {sourceLabel(fact.sourceUrl)}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MatchResultList } from "@/components/tools/clinic-results";
import {
  directoryHref,
  matchClinics,
  type ClinicMatchIndex,
  type MatchQuery,
} from "@/lib/tools/match";
import { cn } from "@/lib/utils";

/**
 * The "and here are the clinics" section a tool result ends on.
 *
 * The cost calculator and the match quiz both grew their own version of this
 * block, and the tools that end in a number or a table had nothing: a visitor
 * who had just scored their hip at 62 or read the whole comparison table was
 * handed an explainer and no way through to a listing. This is that block,
 * factored out, so a tool adds a shortlist by rendering one element with a
 * query rather than by copying forty lines.
 *
 * Three properties it inherits from `lib/tools/match.ts` and keeps deliberately:
 *
 *  - **Placement is not sold.** Ranking is fit, then rating, then review count.
 *    A clinic's plan or featured flag never reaches this list.
 *  - **Every row shows its misses.** `MatchResultList` prints what a clinic does
 *    not match on, which is what stops three partial matches reading as three
 *    endorsements.
 *  - **It never invents a list.** With no query, no matching clinics, or an
 *    empty index, it falls back to a plain directory link. A symptom score with
 *    three arbitrary clinics under it would be worse than a score with none.
 *
 * On a symptom score in particular: this is navigation, not advice. The list is
 * keyed to the condition the questionnaire is about, never to the band the score
 * landed in, so a severe score and a mild one see the same clinics. Ranking
 * clinics by how badly somebody scored would be a clinical judgement this site
 * has no basis for making.
 */
export interface RelatedClinicsProps {
  index: ClinicMatchIndex;
  /** What to match on. Usually a condition, sometimes a condition and country. */
  query: MatchQuery;
  /** Section heading. */
  title: string;
  /** The sentence under it, saying what the list is and is not. */
  intro: React.ReactNode;
  /** Label on the link through to the filtered directory. */
  ctaLabel: string;
  /** How many rows to show. Three is a shortlist; ten is a directory. */
  limit?: number;
  className?: string;
}

export function RelatedClinics({
  index,
  query,
  title,
  intro,
  ctaLabel,
  limit = 3,
  className,
}: RelatedClinicsProps) {
  const outcome = React.useMemo(
    () => matchClinics(index, query, limit),
    [index, query, limit],
  );

  // Nothing published, or a slug this directory has no clinics for. Both end in
  // the same place: a way into the directory, and no invented shortlist.
  if (!index.clinicCount || !outcome.results.length) {
    return (
      <section className={cn("mt-6 border-t border-border pt-5", className)}>
        <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
          {title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
          No listed clinic matches that closely enough to shortlist, so here is
          the directory to search instead.
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={directoryHref(query, index)}>Browse the directory</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className={cn("mt-6 border-t border-border pt-5", className)}>
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
        {title}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
        {intro}
      </p>
      <MatchResultList
        className="mt-4"
        matches={outcome.results}
        currency={index.currency}
        numbered={false}
      />
      <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
        Ordered by how well each listing fits, then by rating. Placement here is
        not sold and a clinic&apos;s listing plan has no effect on it. Being
        listed is not an endorsement of the clinic or of any treatment it
        offers.
      </p>
      <Button asChild className="mt-4">
        <Link href={directoryHref(query, index)}>{ctaLabel}</Link>
      </Button>
    </section>
  );
}

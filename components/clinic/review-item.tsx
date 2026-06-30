"use client";

import * as React from "react";
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  MessageSquare,
  ThumbsUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/ui/rating-stars";
import { Chip } from "@/components/ui/chip";
import { ReportDialog } from "@/components/compliance/report-dialog";
import { SITE_NAME } from "@/config/site";
import type { ReviewView } from "@/lib/public-data";

const BODY_SECTIONS: { key: keyof ReviewView["body"]; label: string }[] = [
  { key: "condition", label: "Background" },
  { key: "whyChosen", label: "Why this clinic" },
  { key: "treatmentDescription", label: "Treatment received" },
  { key: "outcome", label: "Outcome" },
  { key: "experience", label: "Experience" },
  { key: "improvement", label: "What could be better" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

/**
 * ReviewItem — a single patient review (PRD §6.4). Sub-ratings summary, headline,
 * collapsible structured body, "why chosen" tags, a helpful vote (POSTs to the
 * API), and an optional provider response. Reviewer is shown as their display
 * name or "Verified Patient" (anonymized) — email is never exposed (PRD §14).
 */
export function ReviewItem({ review }: { review: ReviewView }) {
  const [expanded, setExpanded] = React.useState(false);
  const [helpful, setHelpful] = React.useState(review.helpfulCount);
  const [voted, setVoted] = React.useState(false);

  const sections = BODY_SECTIONS.filter(({ key }) => review.body?.[key]);
  const preview = sections.slice(0, 1);
  const rest = sections.slice(1);

  async function vote() {
    if (voted) return;
    setVoted(true);
    setHelpful((n) => n + 1);
    try {
      const res = await fetch(`/api/reviews/${review.id}/helpful`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { helpfulCount?: number };
      if (typeof data.helpfulCount === "number") setHelpful(data.helpfulCount);
    } catch {
      setVoted(false);
      setHelpful((n) => Math.max(0, n - 1));
    }
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-semibold text-text-primary">
              {review.displayName}
            </span>
            {review.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-tint px-1.5 py-0.5 text-[11px] font-semibold text-azure-700">
                <BadgeCheck className="size-3" aria-hidden="true" />
                Verified
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-muted">
            {review.country ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden="true" />
                {review.country}
              </span>
            ) : null}
            {review.treatmentDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3" aria-hidden="true" />
                {review.treatmentDate}
              </span>
            ) : (
              <span>{formatDate(review.createdAt)}</span>
            )}
          </div>
        </div>
        <RatingStars value={review.ratingOverall} size={15} showValue countStyle="compact" />
      </div>

      {(review.treatmentName || review.conditionName || review.cost) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.treatmentName ? (
            <Chip size="sm">{review.treatmentName}</Chip>
          ) : null}
          {review.conditionName ? (
            <Chip size="sm">{review.conditionName}</Chip>
          ) : null}
          {review.cost ? (
            <Chip size="sm">
              {review.cost.isConfidential
                ? "Cost: confidential"
                : (review.cost.range ?? "Cost shared")}
            </Chip>
          ) : null}
        </div>
      )}

      {review.headline ? (
        <h3 className="mt-3 font-display text-base font-semibold text-text-primary">
          {review.headline}
        </h3>
      ) : null}

      {sections.length ? (
        <div className="mt-2 space-y-3">
          {(expanded ? sections : preview).map(({ key, label }) => (
            <div key={key}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                {label}
              </p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-text-secondary">
                {review.body[key]}
              </p>
            </div>
          ))}
          {rest.length ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[13px] font-semibold text-text-link transition-colors hover:text-primary"
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Read full review"}
            </button>
          ) : null}
        </div>
      ) : null}

      {review.whyChosenTags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.whyChosenTags.map((tag) => (
            <Chip key={tag} size="sm">
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={vote}
          disabled={voted}
          className={cn(
            "inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors",
            voted
              ? "text-primary"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          <ThumbsUp
            className={cn("size-3.5", voted && "fill-current")}
            aria-hidden="true"
          />
          Helpful{helpful > 0 ? ` (${helpful})` : ""}
        </button>
        <ReportDialog
          entityType="review"
          entityId={review.id}
          label="this review"
          className="ml-auto"
        />
      </div>

      {review.providerResponse ? (
        <div className="mt-3 rounded-lg bg-surface-alt p-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary">
            <MessageSquare className="size-3.5 text-primary" aria-hidden="true" />
            Response from the clinic
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
            {review.providerResponse.body}
          </p>
          <p className="sr-only">Moderated by {SITE_NAME}.</p>
        </div>
      ) : null}
    </article>
  );
}

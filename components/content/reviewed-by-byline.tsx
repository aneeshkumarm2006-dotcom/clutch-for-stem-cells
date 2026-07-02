import * as React from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** Serializable reviewer identity passed from a server page. */
export interface ReviewerByline {
  name: string;
  /** Post-nominal credentials, e.g. "MD, PhD". */
  credentials?: string;
  title?: string;
  /** Slug for a future `/reviewers/[slug]` bio page (optional link target). */
  slug?: string;
  /** Authoritative profile URLs → schema `sameAs` (byline itself ignores these). */
  sameAs?: string[];
}

function formatDate(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * "Medically reviewed by … · Last reviewed {date}" byline — the on-page E-E-A-T
 * signal that pairs with the `MedicalWebPage.reviewedBy`/`lastReviewed` schema.
 *
 * Renders nothing when no reviewer is set: attribution stays hidden until a real
 * credentialed reviewer is supplied (we never show a fabricated reviewer).
 */
export function ReviewedByByline({
  reviewer,
  lastReviewedAt,
  updatedAt,
  className,
}: {
  reviewer?: ReviewerByline | null;
  lastReviewedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  className?: string;
}) {
  if (!reviewer?.name) return null;

  const reviewed = formatDate(lastReviewedAt);
  const updated = formatDate(updatedAt);
  const nameLabel = reviewer.credentials
    ? `${reviewer.name}, ${reviewer.credentials}`
    : reviewer.name;

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-muted",
        className,
      )}
    >
      <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        Medically reviewed by{" "}
        {reviewer.slug ? (
          <Link
            href={`/reviewers/${reviewer.slug}`}
            className="font-medium text-text-secondary hover:underline"
          >
            {nameLabel}
          </Link>
        ) : (
          <span className="font-medium text-text-secondary">{nameLabel}</span>
        )}
      </span>
      {reviewed ? <span>· Last reviewed {reviewed}</span> : null}
      {updated && updated !== reviewed ? (
        <span>· Updated {updated}</span>
      ) : null}
    </p>
  );
}

import * as React from "react";
import Link from "next/link";
import { MapPin, ArrowRight, MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";
import { getInitials, formatPrice } from "@/lib/format";
import { RatingStars } from "@/components/ui/rating-stars";
import { VerifiedBadge, FeaturedBadge } from "@/components/ui/verified-badge";
import { Chip } from "@/components/ui/chip";
import type { VerificationBadge, PriceModel } from "@/lib/enums";

/**
 * Card-shaped view model for a clinic. Decoupled from the Mongoose document so
 * the card stays presentational — directory/profile pages map their
 * `ClinicListItem` (taxonomy ids resolved to labels) into this shape.
 */
export interface ClinicCardData {
  slug: string;
  name: string;
  /** Pre-formatted "City, Country". */
  location?: string;
  logoUrl?: string;
  /** Verification tier — `null`/omitted renders no badge. */
  badge?: VerificationBadge | null;
  featured?: boolean;
  ratingAvg: number;
  reviewCount: number;
  /** Treatment/condition labels (2–4 shown). */
  chips?: string[];
  /** Optional service-focus summary, e.g. "60% MSC therapy · 25% exosomes". */
  focusLabel?: string;
  priceMin?: number | null;
  currency?: string;
  priceModel?: PriceModel;
}

export interface ClinicCardProps {
  clinic: ClinicCardData;
  /** Profile link (defaults to `/clinic/[slug]`). */
  href?: string;
  /** Max chips to render before truncating (the rest collapse into "+N"). */
  maxChips?: number;
  /** Floating top-right control (e.g. a shortlist Save button). */
  actionSlot?: React.ReactNode;
  className?: string;
}

/**
 * ClinicCard — Design §10.4. The core directory unit. The whole card links to
 * the profile via an overlay on the title link (so the article has a single
 * accessible name); the "Reviews" link sits above the overlay and jumps
 * straight to `/clinic/[slug]/reviews`. Hover: border `azure-200`, lift,
 * `shadow-md`.
 */
export function ClinicCard({
  clinic,
  href,
  maxChips = 3,
  actionSlot,
  className,
}: ClinicCardProps) {
  const {
    slug,
    name,
    location,
    logoUrl,
    badge,
    featured,
    ratingAvg,
    reviewCount,
    chips,
    focusLabel,
    priceMin,
    currency,
    priceModel,
  } = clinic;

  const profileHref = href ?? `/clinic/${slug}`;
  const reviewsHref = `/clinic/${slug}/reviews`;
  const allChips = chips ?? [];
  const shownChips = allChips.slice(0, maxChips);
  const extraChips = allChips.length - shownChips.length;
  // Narrow `priceMin` here so the footer can render a plain string.
  const priceLabel =
    priceMin != null && priceModel !== "consult_to_quote"
      ? formatPrice(priceMin, currency ? { currency } : undefined)
      : null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-surface p-5 shadow-card transition-all duration-200",
        "hover:border-azure-200 hover:shadow-md motion-safe:hover:-translate-y-0.5",
        "focus-within:border-azure-200",
        featured ? "border-azure-200" : "border-border",
        className,
      )}
    >
      {featured ? (
        <FeaturedBadge className="absolute -top-2.5 left-5 shadow-xs" />
      ) : null}

      {actionSlot ? (
        <div className="absolute right-3 top-3 z-[2]">{actionSlot}</div>
      ) : null}

      {/* Top row: logo · name / location + verification */}
      <div className={cn("flex items-start gap-3.5", actionSlot && "pr-9")}>
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-tint font-display text-base font-bold text-azure-700 ring-1 ring-inset ring-border">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            getInitials(name)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[19px] font-semibold leading-snug tracking-[-0.01em] text-text-primary">
            <Link
              href={profileHref}
              className="rounded-sm decoration-azure-300 underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:underline"
            >
              {name}
            </Link>
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {location ? (
              <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-text-secondary">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </span>
            ) : null}
            {badge ? <VerifiedBadge badge={badge} /> : null}
          </div>
        </div>
      </div>

      {/* Rating row — the count links straight to the reviews tab */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <RatingStars value={ratingAvg} showValue />
        {reviewCount > 0 ? (
          <Link
            href={reviewsHref}
            aria-label={`Read ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"} of ${name}`}
            className="relative z-[1] text-[13px] font-medium text-text-link underline-offset-2 hover:underline focus-visible:outline-none"
          >
            {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </Link>
        ) : (
          <span className="text-[13px] text-text-muted">No reviews yet</span>
        )}
      </div>

      {/* Optional service-focus line */}
      {focusLabel ? (
        <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-text-secondary">
          {focusLabel}
        </p>
      ) : null}

      {/* Chips */}
      {shownChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shownChips.map((chip) => (
            <Chip key={chip} size="sm">
              {chip}
            </Chip>
          ))}
          {extraChips > 0 ? (
            <Chip size="sm" className="text-text-muted">
              +{extraChips}
            </Chip>
          ) : null}
        </div>
      ) : null}

      {/* Footer: price · reviews · profile (pinned so cards align in a grid) */}
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-3 border-t border-border pt-3.5">
          <div className="min-w-0">
            {priceLabel ? (
              <>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Starting from
                </p>
                <p className="font-display text-[17px] font-bold tracking-[-0.01em] text-text-primary">
                  {priceLabel}
                </p>
              </>
            ) : (
              <p className="font-display text-[15px] font-semibold text-text-primary">
                Pricing on consultation
              </p>
            )}
          </div>

          <div className="relative z-[1] flex shrink-0 items-center gap-2">
            <Link
              href={reviewsHref}
              aria-label={`Reviews of ${name}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:border-azure-200 hover:bg-azure-50 hover:text-text-link focus-visible:outline-none"
            >
              <MessageSquareText className="size-3.5" aria-hidden="true" />
              Reviews
            </Link>
            {/* A real link, not a decorative span: this row sits above the
                title link's full-card overlay, so a span here would swallow
                the click instead of navigating. */}
            <Link
              href={profileHref}
              tabIndex={-1}
              aria-hidden="true"
              className="inline-flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-[13px] font-semibold text-azure-700 transition-colors hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white focus-visible:outline-none"
            >
              View profile
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

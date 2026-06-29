import * as React from "react";
import Link from "next/link";
import { MapPin, ArrowRight, ExternalLink } from "lucide-react";

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
  /** Tracked outbound link to the clinic website (`/r/[clinicId]`). */
  websiteHref?: string;
}

export interface ClinicCardProps {
  clinic: ClinicCardData;
  /** Profile link (defaults to `/clinic/[slug]`). */
  href?: string;
  /** Max chips to render before truncating. */
  maxChips?: number;
  /** Floating top-right control (e.g. a shortlist Save button). */
  actionSlot?: React.ReactNode;
  className?: string;
}

/**
 * ClinicCard — Design §10.4. The core directory unit. The whole card links to
 * the profile via an overlay on the title link (so the article has a single
 * accessible name); the optional "Visit website" link sits above the overlay
 * with its own tracked href. Hover: border `azure-200`, lift, `shadow-md`.
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
    websiteHref,
  } = clinic;

  const profileHref = href ?? `/clinic/${slug}`;
  const shownChips = chips?.slice(0, maxChips) ?? [];
  // Narrow `priceMin` here so the footer can render a plain string.
  const priceLabel =
    priceMin != null && priceModel !== "consult_to_quote"
      ? formatPrice(priceMin, currency ? { currency } : undefined)
      : null;

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border bg-surface p-5 shadow-card transition-all duration-200",
        "hover:border-azure-200 hover:shadow-md motion-safe:hover:-translate-y-0.5",
        "focus-within:border-azure-200",
        featured ? "border-azure-200" : "border-border",
        className,
      )}
    >
      {featured ? (
        <FeaturedBadge className="absolute -top-2.5 left-4 shadow-xs" />
      ) : null}

      {actionSlot ? (
        <div className="absolute right-3 top-3 z-[2]">{actionSlot}</div>
      ) : null}

      {/* Top row: logo · name/location · verified badge */}
      <div className={cn("flex items-start gap-3", actionSlot && "pr-9")}>
        <span className="flex size-[46px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-tint font-display text-base font-bold text-azure-700">
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
          <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.01em] text-text-primary">
            <Link
              href={profileHref}
              className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {name}
            </Link>
          </h3>
          {location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-text-secondary">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
        </div>

        {badge ? <VerifiedBadge badge={badge} className="shrink-0" /> : null}
      </div>

      {/* Rating row */}
      <div className="mt-3">
        <RatingStars value={ratingAvg} reviewCount={reviewCount} />
      </div>

      {/* Optional service-focus line */}
      {focusLabel ? (
        <p className="mt-2.5 text-[13.5px] text-text-secondary">{focusLabel}</p>
      ) : null}

      {/* Chips */}
      {shownChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {shownChips.map((chip) => (
            <Chip key={chip} size="sm">
              {chip}
            </Chip>
          ))}
        </div>
      ) : null}

      {/* Footer: price · actions */}
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3.5">
        <div className="min-w-0">
          {priceLabel ? (
            <>
              <p className="text-[11px] text-text-muted">Starting from</p>
              <p className="font-display text-base font-bold tracking-[-0.01em] text-text-primary">
                {priceLabel}
              </p>
            </>
          ) : (
            <p className="font-display text-[15px] font-semibold text-text-primary">
              Pricing on consultation
            </p>
          )}
        </div>

        <div className="relative z-[1] flex shrink-0 items-center gap-3">
          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-link hover:underline focus-visible:outline-none"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Visit website
            </a>
          ) : null}
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1 text-sm font-semibold text-text-link transition-colors group-hover:text-primary"
          >
            View profile
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

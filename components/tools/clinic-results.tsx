"use client";

import * as React from "react";
import Link from "next/link";
import { Check, MapPin, Minus } from "lucide-react";

import { RatingStars } from "@/components/ui/rating-stars";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { RemoteImage } from "@/components/common/remote-image";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClinicMatch, MatchClinic } from "@/lib/tools/match";
import type { VerificationBadge } from "@/lib/enums";

/**
 * The clinic result row the matching tools share.
 *
 * Deliberately not `ClinicCard`. The directory card is built to sell a listing:
 * one big link surface, a featured flag, chips. This row has a different job,
 * which is to show why a clinic is on the list, and that means it has to be able
 * to print "does not treat knee osteoarthritis" next to the name. A card whose
 * whole surface is a link cannot carry that without turning the reasons into
 * part of the link text.
 *
 * The misses are the point. A result list that only shows what matched reads as
 * an endorsement of every row, including the third one that is there because
 * nothing better existed.
 */

function PriceLine({
  clinic,
  currency,
}: {
  clinic: MatchClinic;
  currency: string;
}) {
  const cur = clinic.currency ?? currency;
  const money = (v: number) => formatPrice(v, { currency: cur });

  if (clinic.priceMin && clinic.priceMax && clinic.priceMax > clinic.priceMin) {
    return (
      <>
        {money(clinic.priceMin)} to {money(clinic.priceMax)}
      </>
    );
  }
  const single = clinic.priceMin ?? clinic.priceMax;
  if (single) return <>From {money(single)}</>;
  return <span className="text-text-muted">Price not published</span>;
}

export function MatchResultRow({
  match,
  currency,
  rank,
}: {
  match: ClinicMatch;
  currency: string;
  /** 1-based position, shown so the ordering is explicit rather than implied. */
  rank?: number;
}) {
  const { clinic, reasons, misses, score } = match;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {clinic.logoUrl ? (
          <RemoteImage
            src={clinic.logoUrl}
            alt=""
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-md border border-border object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-alt font-display text-[15px] font-semibold text-text-muted"
          >
            {clinic.name.slice(0, 1)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {rank ? (
              <span className="text-[12px] font-semibold text-text-muted">
                {rank}.
              </span>
            ) : null}
            <Link
              href={`/clinic/${clinic.slug}`}
              className="font-display text-[16px] font-semibold tracking-[-0.01em] text-text-primary hover:text-primary"
            >
              {clinic.name}
            </Link>
            {clinic.badge ? (
              <VerifiedBadge badge={clinic.badge as VerificationBadge} />
            ) : null}
          </div>

          {clinic.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-text-secondary">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              {clinic.location}
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-secondary">
            {clinic.reviewCount > 0 ? (
              <RatingStars
                value={clinic.ratingAvg}
                reviewCount={clinic.reviewCount}
                countStyle="compact"
                size={13}
              />
            ) : (
              <span className="text-text-muted">No reviews yet</span>
            )}
            <span>
              <PriceLine clinic={clinic} currency={currency} />
            </span>
          </div>
        </div>

        <span
          className="shrink-0 rounded-md bg-tint px-2 py-1 text-center"
          title="How many of your criteria this clinic meets"
        >
          <span className="block font-display text-[15px] font-semibold leading-none text-azure-700">
            {score}%
          </span>
          <span className="mt-0.5 block text-[10.5px] uppercase tracking-[0.05em] text-azure-700">
            match
          </span>
        </span>
      </div>

      {reasons.length || misses.length ? (
        <ul className="mt-3 grid gap-1 border-t border-border pt-3 sm:grid-cols-2">
          {reasons.map((r) => (
            <li
              key={`r-${r.criterion}`}
              className="flex items-start gap-1.5 text-[12.5px] text-text-secondary"
            >
              <Check
                className="mt-[3px] size-3.5 shrink-0 text-success"
                aria-hidden="true"
              />
              {r.label}
            </li>
          ))}
          {misses.map((m) => (
            <li
              key={`m-${m.criterion}`}
              className="flex items-start gap-1.5 text-[12.5px] text-text-muted"
            >
              <Minus className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
              {m.label}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** A list of matches, or the honest empty state. */
export function MatchResultList({
  matches,
  currency,
  numbered = true,
  className,
}: {
  matches: ClinicMatch[];
  currency: string;
  numbered?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {matches.map((match, i) => (
        <MatchResultRow
          key={match.clinic.slug}
          match={match}
          currency={currency}
          rank={numbered ? i + 1 : undefined}
        />
      ))}
    </div>
  );
}

import * as React from "react";
import { ExternalLink, MessagesSquare, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { Chip } from "@/components/ui/chip";
import type { ExternalReviewsView } from "@/lib/public-data";
import type { ExternalSentiment } from "@/lib/enums";

/**
 * ExternalReviews — what a clinic looks like on Google and Reddit, shown on
 * `/clinic/[slug]/reviews` above this site's own reviews.
 *
 * Three rules this component exists to enforce, all of them visible in the
 * markup rather than left to whoever fills the data in:
 *
 *  1. **Never mistakable for our own rating.** The section is headed as
 *     off-site, each panel names its platform, and the Google figure is always
 *     rendered as "4.7 on Google" with its count. The page's own average lives
 *     in a separate block above with its own heading.
 *  2. **Always dated.** A third-party rating read once is a snapshot; an undated
 *     one implies a freshness we can't promise. Every panel carries the month it
 *     was last checked, and a panel with no `checkedAt` says "date not recorded"
 *     rather than quietly omitting it.
 *  3. **Our prose and their words, never blended.** Summaries and themes are
 *     written by our editors. Verbatim reviewer text appears only inside
 *     `Highlights`, under a heading that says whose words they are, with the
 *     reviewer's name and the date attached to each one.
 *
 * Server-rendered plain markup, like `RatingHistogram` beside it, so the text
 * is in the HTML for crawlers and AI answer engines.
 *
 * Deliberately absent: any JSON-LD. Marking third-party ratings or review text
 * up as this site's `aggregateRating`/`Review` nodes is the review-snippet
 * abuse Google penalises, so this block is presentational only — see
 * `models/clinic.ts`.
 *
 * `compact` renders the same data for the clinic profile, where this sits under
 * a "Reviews" heading that already exists: the section heading and intro drop
 * to sub-heading size and the Reddit panel's thread list is suppressed, so the
 * profile gets the reception signal without a second full-width review section
 * competing with the page's own.
 */
export function ExternalReviews({
  external,
  clinicName,
  className,
  compact = false,
  headingId = "external-reviews",
}: {
  external: ExternalReviewsView;
  clinicName: string;
  className?: string;
  compact?: boolean;
  headingId?: string;
}) {
  const { google, reddit } = external;
  if (!google && !reddit) return null;

  const Heading = compact ? "h3" : "h2";

  return (
    <section aria-labelledby={headingId} className={cn(className)}>
      <Heading
        id={headingId}
        className={cn(
          "font-display font-semibold text-text-primary",
          compact ? "text-[15px]" : "text-xl",
        )}
      >
        What {clinicName} looks like elsewhere
      </Heading>
      <p
        className={cn(
          "mt-1.5 max-w-2xl leading-relaxed text-text-secondary",
          compact ? "text-[13px]" : "text-[13.5px]",
        )}
      >
        Third-party sources, summarised by our editors and quoted where a
        reviewer said it best. These are not {clinicName}&apos;s reviews on this
        site and are not counted in its rating here.
      </p>

      <div
        className={cn(
          "mt-4 grid gap-4",
          google && reddit ? "sm:grid-cols-2" : "sm:grid-cols-1",
        )}
      >
        {google ? <GooglePanel google={google} /> : null}
        {reddit ? <RedditPanel reddit={reddit} compact={compact} /> : null}
      </div>
    </section>
  );
}

function GooglePanel({
  google,
}: {
  google: NonNullable<ExternalReviewsView["google"]>;
}) {
  const hasRating = google.rating != null;

  return (
    <Panel
      icon={<Star className="size-4" aria-hidden="true" />}
      title="Google reviews"
      checkedAt={google.checkedAt}
      href={google.url}
      hrefLabel="View the Google listing"
    >
      {hasRating ? (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-3xl font-bold leading-none text-text-primary">
            {google.rating!.toFixed(1)}
          </span>
          <span className="text-[13px] text-text-secondary">
            out of 5 on Google
            {google.reviewCount != null
              ? ` from ${formatCount(google.reviewCount)} ${
                  google.reviewCount === 1 ? "rating" : "ratings"
                }`
              : ""}
          </span>
        </p>
      ) : null}

      {google.summary ? (
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">
          {google.summary}
        </p>
      ) : null}

      {/* The label has to follow the evidence. With no confirmed Google rating
          the themes were drawn from whatever aggregator was readable, and
          calling those "most-mentioned on Google" would attribute them to a
          source that never produced them. */}
      {google.themes.length ? (
        <Themes
          label={hasRating ? "Most-mentioned on Google" : "Recurring points"}
          themes={google.themes}
        />
      ) : null}

      {google.highlights.length ? (
        <Highlights highlights={google.highlights} />
      ) : null}
    </Panel>
  );
}

/**
 * Verbatim Google reviews, attributed.
 *
 * The heading does the work the markup can't: these are the only sentences in
 * the whole block this site didn't write, and a reader skimming past a quote
 * shouldn't come away thinking an editor endorsed it. Each `<blockquote>` names
 * its reviewer and dates itself, and links back to the source where one exists,
 * so the quote is checkable rather than merely asserted.
 *
 * No JSON-LD here either, for the same reason as the rest of the block: a
 * `Review` node built from someone else's review is the thing that earns a
 * manual action.
 */
function Highlights({
  highlights,
}: {
  highlights: NonNullable<ExternalReviewsView["google"]>["highlights"];
}) {
  return (
    <div className="mt-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
        In reviewers&apos; own words
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-text-muted">
        Quoted from Google, not written by us.
      </p>
      <ul className="mt-2.5 space-y-3">
        {highlights.map((h, i) => (
          <li key={`${h.author}-${i}`}>
            <blockquote className="border-l-2 border-border-strong pl-3">
              <p className="text-[13.5px] italic leading-relaxed text-text-secondary">
                &ldquo;{h.text}&rdquo;
              </p>
              <footer className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-text-muted">
                <span className="font-semibold text-text-secondary">
                  {h.author}
                </span>
                {h.rating != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="size-3 fill-current" aria-hidden="true" />
                    {h.rating}
                    <span className="sr-only"> out of 5</span>
                  </span>
                ) : null}
                {/* An exact date when the source gave one, otherwise the
                    source's own relative phrase. Never a date derived from
                    "3 years ago" — see `IExternalReviewHighlight`. */}
                {h.publishedAt ? (
                  <time dateTime={h.publishedAt}>
                    {new Date(h.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                    })}
                  </time>
                ) : h.publishedLabel ? (
                  <span>{h.publishedLabel}</span>
                ) : null}
                {h.url ? (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="text-text-link hover:underline"
                  >
                    on Google
                  </a>
                ) : (
                  <span>on Google</span>
                )}
              </footer>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The sentiment label is the whole point of the Reddit panel — there is no star
 * rating to fall back on. `limited` is spelled out as an absence of evidence
 * rather than a lukewarm verdict, because two passing mentions is not the same
 * finding as a genuinely divided thread.
 */
const SENTIMENT_COPY: Record<ExternalSentiment, string> = {
  positive: "Mostly positive",
  mixed: "Mixed",
  negative: "Mostly negative",
  limited: "Too little discussion to characterise",
};

const SENTIMENT_TONE: Record<ExternalSentiment, string> = {
  positive: "bg-success-bg text-success-fg",
  mixed: "bg-warning-bg text-warning-fg",
  negative: "bg-danger-bg text-danger-fg",
  limited: "bg-tint text-text-secondary",
};

function RedditPanel({
  reddit,
  compact = false,
}: {
  reddit: NonNullable<ExternalReviewsView["reddit"]>;
  compact?: boolean;
}) {
  return (
    <Panel
      icon={<MessagesSquare className="size-4" aria-hidden="true" />}
      title="Reddit discussion"
      checkedAt={reddit.checkedAt}
    >
      <div className="flex flex-wrap items-center gap-2">
        {reddit.sentiment ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
              SENTIMENT_TONE[reddit.sentiment],
            )}
          >
            {SENTIMENT_COPY[reddit.sentiment]}
          </span>
        ) : null}
        {/* Zero is already carried by the sentiment label ("too little
            discussion to characterise"); appending "across 0 threads" restates
            it and reads like a tally we bothered to compute. */}
        {reddit.threadCount ? (
          <span className="text-[12.5px] text-text-muted">
            across {formatCount(reddit.threadCount)}{" "}
            {reddit.threadCount === 1 ? "thread" : "threads"}
          </span>
        ) : null}
      </div>

      {reddit.summary ? (
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">
          {reddit.summary}
        </p>
      ) : null}

      {reddit.themes.length ? (
        <Themes label="Recurring points" themes={reddit.themes} />
      ) : null}

      {reddit.sources.length && !compact ? (
        <div className="mt-4">
          {/* The labels are the posters' own thread titles, reproduced exactly.
              Some are blunt ("<brand> is a scam"), and rewriting them to soften
              that would misrepresent the source. So the heading says whose words
              these are, which is the honest fix: we vouch for the summary above,
              not for a stranger's headline. */}
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            Threads read
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-text-muted">
            Titles below are the Reddit posters&apos; own wording, not ours.
          </p>
          <ul className="mt-1.5 space-y-1">
            {reddit.sources.map((s, i) => (
              <li key={`${s.url ?? s.label}-${i}`}>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    // `ugc` marks these as user-generated third-party links,
                    // which is what they are — we vouch for the summary, not
                    // for the thread.
                    rel="noopener noreferrer nofollow ugc"
                    className="text-[13px] text-text-link hover:underline"
                  >
                    {s.label}
                  </a>
                ) : (
                  <span className="text-[13px] text-text-secondary">
                    {s.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function Themes({ label, themes }: { label: string; themes: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {themes.map((t) => (
          <Chip key={t} size="sm">
            {t}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  checkedAt,
  href,
  hrefLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  checkedAt: string | null;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-text-muted">{icon}</span>
        <h3 className="font-display text-[15px] font-semibold text-text-primary">
          {title}
        </h3>
      </div>

      <div className="mt-3">{children}</div>

      <p className="mt-4 border-t border-border pt-3 text-[12px] text-text-muted">
        {checkedAt ? (
          <>
            Checked{" "}
            <time dateTime={checkedAt}>
              {new Date(checkedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              })}
            </time>
            . Figures on the source may have changed since.
          </>
        ) : (
          "Check date not recorded."
        )}
        {href ? (
          <>
            {" "}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 font-semibold text-text-link hover:underline"
            >
              {hrefLabel ?? "View source"}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

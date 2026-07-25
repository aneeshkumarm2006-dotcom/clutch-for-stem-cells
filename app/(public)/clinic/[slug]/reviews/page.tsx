/**
 * `/clinic/[slug]/reviews` — the dedicated patient-reviews page for a clinic.
 *
 * Why a child route rather than `/reviews/[clinic]` or an on-profile section:
 *  - It sits under the clinic entity, so it inherits the profile's topical
 *    relevance and internal links instead of competing with it from a flat
 *    namespace.
 *  - The last path segment is the query itself — "<clinic name> reviews" — which
 *    is the phrase people (and AI answer engines) actually search.
 *  - The profile keeps a three-review teaser and links here for the full set, so
 *    the two URLs are not near-duplicates of each other.
 *
 * Indexation follows the site-wide directory convention (`lib/seo-indexation.ts`):
 * the clean path is canonical and indexable; sorted/filtered/paged variants are
 * `noindex, follow`. A clinic with no approved reviews is `noindex` too, and is
 * excluded from the sitemap, so we never submit an empty page to the index.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  MessageSquareText,
  Quote,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import { redirectOrNotFound, resolveRedirect } from "@/lib/redirects";
import { pageMetadata } from "@/lib/page-metadata";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import {
  getClinicProfile,
  getClinicReviews,
  getClinicReviewStats,
  type ReviewSortKey,
} from "@/lib/public-data";
import { formatCount, getInitials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { RatingStars, SubRatings } from "@/components/ui/rating-stars";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ReviewItem } from "@/components/clinic/review-item";
import {
  ReviewsControls,
  REVIEWS_PAGE_PARAMS,
} from "@/components/clinic/review-controls";
import { RatingHistogram } from "@/components/clinic/rating-histogram";
import { ConsultationDialog } from "@/components/lead/consultation-dialog";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";

/**
 * Rendered on demand, like every other sortable/filterable route here
 * (`/clinics`, `/treatments/[slug]`): reading `searchParams` opts a route out of
 * prerendering, so `generateStaticParams` would only buy a build-time DB query
 * and no static output.
 */
export const dynamic = "force-dynamic";

/** Reviews are the whole page here, so a deeper page than the profile teaser. */
const PAGE_SIZE = 10;

type SearchParams = Record<string, string | string[] | undefined>;

const single = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}): Promise<Metadata> {
  const clinic = await getClinicProfile(params.slug);
  if (!clinic) return pageMetadata({ title: "Clinic not found" });

  const hq =
    clinic.locations.find((l) => l.isHQ) ?? clinic.locations[0] ?? null;
  const where = hq
    ? ` in ${[hq.city, hq.country].filter(Boolean).join(", ")}`
    : "";
  const plural = clinic.reviewCount === 1 ? "review" : "reviews";

  return pageMetadata({
    // Exact-match the query pattern: "<clinic> reviews".
    title: `${clinic.name} Reviews`,
    description:
      clinic.reviewCount > 0
        ? `${formatCount(clinic.reviewCount)} patient ${plural} of ${clinic.name}${where} — ${clinic.ratingAvg.toFixed(1)} out of 5 across outcome, communication, facility, and value for money.`
        : `Patient reviews of ${clinic.name}${where}. No reviews have been published yet — be the first to share your treatment experience.`,
    path: `/clinic/${clinic.slug}/reviews`,
    image: clinic.coverUrl ?? clinic.logoUrl,
    // Deliberately not `seo: clinic.raw.seo` — that override belongs to the
    // profile, and reusing it would point this page's canonical at the profile.
    noindex: clinic.reviewCount === 0 || shouldNoindexDirectory(searchParams),
  });
}

export default async function ClinicReviewsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  const clinic = await getClinicProfile(params.slug);
  if (!clinic) {
    // A re-slugged clinic has a redirect on its *profile* path, so carry the
    // child segment across: /clinic/old/reviews → /clinic/new/reviews.
    const hit = await resolveRedirect(`/clinic/${params.slug}`);
    if (hit?.to.startsWith("/")) {
      redirect(`${hit.to.replace(/\/+$/, "")}/reviews`);
    }
    return redirectOrNotFound(`/clinic/${params.slug}/reviews`);
  }

  const sort = (single(searchParams.sort) ?? "recent") as ReviewSortKey;
  const page = Number(single(searchParams.page) ?? "1") || 1;
  const treatment = single(searchParams.treatment);
  const condition = single(searchParams.condition);

  const [reviews, stats] = await Promise.all([
    getClinicReviews(clinic.id, {
      page,
      pageSize: PAGE_SIZE,
      sort,
      treatment,
      condition,
    }),
    getClinicReviewStats(clinic.id),
  ]);

  const hq =
    clinic.locations.find((l) => l.isHQ) ?? clinic.locations[0] ?? null;
  const hqLabel = hq ? [hq.city, hq.country].filter(Boolean).join(", ") : null;
  const isFiltered = Boolean(treatment || condition);

  const dialogConditions = clinic.conditions.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // Same `clinic` content type as the profile, so any per-record schema
  // overrides an editor set in the admin panel still apply. The `MedicalClinic`
  // node keeps the profile as its canonical `url`; this page just carries a
  // deeper slice of `Review` nodes, which is where they belong.
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "clinic",
    {
      clinic: clinic.raw,
      reviews: reviews.reviews.map(
        (r) =>
          ({
            reviewer: {
              isAnonymous: r.displayName === "Verified Patient",
              displayName: r.displayName,
            },
            ratingOverall: r.ratingOverall,
            headline: r.headline,
            body: r.body,
            createdAt: new Date(r.createdAt),
            clinicName: clinic.name,
          }) as never,
      ),
    },
    ctx,
    clinic.raw.schemaOverrides ?? null,
  );

  /** Preserves the active sort/filters while changing page. */
  const hrefForPage = (p: number) => {
    const sp = new URLSearchParams();
    if (sort !== "recent") sp.set(REVIEWS_PAGE_PARAMS.sort, sort);
    if (treatment) sp.set(REVIEWS_PAGE_PARAMS.treatment, treatment);
    if (condition) sp.set(REVIEWS_PAGE_PARAMS.condition, condition);
    if (p > 1) sp.set(REVIEWS_PAGE_PARAMS.page, String(p));
    const qs = sp.toString();
    return `/clinic/${clinic.slug}/reviews${qs ? `?${qs}` : ""}#reviews`;
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Header */}
      <div className="border-b border-border bg-surface">
        <div className="container py-6 md:py-8">
          <Breadcrumbs
            className="mb-4"
            items={[
              { name: "Home", href: "/" },
              { name: "Clinics", href: "/clinics" },
              { name: clinic.name, href: `/clinic/${clinic.slug}` },
              { name: "Reviews", href: `/clinic/${clinic.slug}/reviews` },
            ]}
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-tint font-display text-lg font-bold text-azure-700">
                {clinic.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clinic.logoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  getInitials(clinic.name)
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[30px]">
                    {clinic.name} reviews
                  </h1>
                  {clinic.badge ? <VerifiedBadge badge={clinic.badge} /> : null}
                </div>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
                  {stats.total > 0 ? (
                    <>
                      {formatCount(stats.total)} published{" "}
                      {stats.total === 1 ? "review" : "reviews"} from patients
                      treated at {clinic.name}
                      {hqLabel ? ` in ${hqLabel}` : ""}, averaging{" "}
                      {clinic.ratingAvg.toFixed(1)} out of 5. Every review is
                      moderated before it appears.
                    </>
                  ) : (
                    <>
                      No patient reviews have been published for {clinic.name}
                      {hqLabel ? ` in ${hqLabel}` : ""} yet. If you were treated
                      here, your account is the one that helps the next patient.
                    </>
                  )}
                </p>
                <Link
                  href={`/clinic/${clinic.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-text-link hover:underline"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to the full {clinic.name} profile
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild>
                <Link href={`/reviews/new?clinic=${clinic.slug}`}>
                  Write a review
                </Link>
              </Button>
              <ConsultationDialog
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                source={`reviews:${clinic.slug}`}
                trigger={
                  <Button variant="secondary">
                    <MessageSquareText
                      className="size-[18px]"
                      aria-hidden="true"
                    />
                    Request a consultation
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0">
          {/* Rating summary */}
          {stats.total > 0 ? (
            <section aria-labelledby="rating-summary">
              <h2
                id="rating-summary"
                className="font-display text-xl font-semibold text-text-primary"
              >
                Rating summary
              </h2>

              <div className="mt-4 grid gap-6 rounded-xl border border-border bg-surface p-5 shadow-card sm:grid-cols-[auto_1fr]">
                <div className="text-center sm:w-40 sm:border-r sm:border-border sm:pr-6">
                  <div className="font-display text-5xl font-bold leading-none text-text-primary">
                    {clinic.ratingAvg.toFixed(1)}
                  </div>
                  <RatingStars
                    value={clinic.ratingAvg}
                    showValue={false}
                    className="mt-2 justify-center"
                  />
                  <p className="mt-1.5 text-[12.5px] text-text-muted">
                    {formatCount(stats.total)}{" "}
                    {stats.total === 1 ? "review" : "reviews"}
                  </p>
                </div>
                <RatingHistogram distribution={stats.distribution} />
              </div>

              {/* Headline stats — unique to this page, and the numbers an AI
                  answer engine can lift as a direct answer. */}
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                {stats.recommendRate != null ? (
                  <StatCard
                    icon={<ThumbsUp className="size-4" />}
                    label="Would recommend"
                    value={`${stats.recommendRate}%`}
                  />
                ) : null}
                <StatCard
                  icon={<ShieldCheck className="size-4" />}
                  label="Verified reviews"
                  value={`${formatCount(stats.verifiedCount)} of ${formatCount(stats.total)}`}
                />
                {stats.lastReviewedAt ? (
                  <StatCard
                    icon={<Quote className="size-4" />}
                    label="Most recent review"
                    value={new Date(stats.lastReviewedAt).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long" },
                    )}
                  />
                ) : null}
              </dl>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-text-primary">
                    Ratings by category
                  </h3>
                  <SubRatings
                    breakdown={clinic.ratingBreakdown}
                    className="mt-3"
                  />
                </div>
                {clinic.topMentions.length ? (
                  <div>
                    <h3 className="text-[13px] font-semibold text-text-primary">
                      What patients mention most
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {clinic.topMentions.map((m) => (
                        <Chip key={m.tag} size="sm">
                          {m.tag} ({m.count})
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <DisclaimerNote variant="results" className="mt-6" />
            </section>
          ) : null}

          {/* Review list */}
          <section id="reviews" className="mt-10 scroll-mt-24">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                {stats.total > 0
                  ? `All ${formatCount(stats.total)} ${stats.total === 1 ? "review" : "reviews"}`
                  : "Patient reviews"}
              </h2>
              {stats.total > 0 ? (
                <ReviewsControls
                  keys={REVIEWS_PAGE_PARAMS}
                  treatments={clinic.treatments.map((t) => ({
                    slug: t.slug,
                    name: t.name,
                  }))}
                  conditions={clinic.conditions.map((c) => ({
                    slug: c.slug,
                    name: c.name,
                  }))}
                />
              ) : null}
            </div>

            {isFiltered ? (
              <p className="mt-3 text-[13.5px] text-text-secondary">
                Showing {formatCount(reviews.total)} of{" "}
                {formatCount(stats.total)} reviews.{" "}
                <Link
                  href={`/clinic/${clinic.slug}/reviews#reviews`}
                  className="font-semibold text-text-link hover:underline"
                >
                  Clear filters
                </Link>
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              {reviews.reviews.length ? (
                reviews.reviews.map((r) => <ReviewItem key={r.id} review={r} />)
              ) : (
                <EmptyState
                  icon={Quote}
                  title={
                    isFiltered
                      ? "No reviews match those filters"
                      : "No reviews yet"
                  }
                  description={
                    isFiltered
                      ? "Try a different treatment or condition, or clear the filters to see every review."
                      : `Be the first to share what treatment at ${clinic.name} was actually like.`
                  }
                  action={
                    <Button asChild>
                      <Link href={`/reviews/new?clinic=${clinic.slug}`}>
                        Write a review
                      </Link>
                    </Button>
                  }
                />
              )}
            </div>

            {reviews.pageCount > 1 ? (
              <Pagination
                className="mt-8"
                page={reviews.page}
                totalPages={reviews.pageCount}
                hrefFor={hrefForPage}
              />
            ) : null}
          </section>
        </div>

        {/* Rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="font-display text-base font-semibold text-text-primary">
              Been treated at {clinic.name}?
            </p>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              Reviews are moderated and published without the clinic&apos;s
              approval. Read our{" "}
              <Link
                href="/methodology"
                className="font-semibold text-text-link hover:underline"
              >
                review policy
              </Link>
              .
            </p>
            <Button asChild className="mt-4 w-full">
              <Link href={`/reviews/new?clinic=${clinic.slug}`}>
                Write a review
              </Link>
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="font-display text-base font-semibold text-text-primary">
              Considering {clinic.name}?
            </p>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              Request a consultation — no obligation.
            </p>
            <div className="mt-4">
              <ConsultationDialog
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                source={`reviews-rail:${clinic.slug}`}
                trigger={
                  <Button className="w-full">
                    <MessageSquareText
                      className="size-[18px]"
                      aria-hidden="true"
                    />
                    Request a consultation
                  </Button>
                }
              />
            </div>
            <Link
              href={`/clinic/${clinic.slug}`}
              className="mt-3 inline-block text-[13px] font-semibold text-text-link hover:underline"
            >
              See treatments, pricing &amp; accreditations
            </Link>
          </div>

          <DisclaimerNote variant="medical" className="mt-4" />
        </aside>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt p-4">
      <dt className="flex items-center gap-1.5 text-[12px] text-text-muted">
        <span className="text-text-muted">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-[15px] font-semibold text-text-primary">
        {value}
      </dd>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe,
  Languages,
  MapPin,
  MessageSquareText,
  Quote,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import {
  buildMetadata,
  breadcrumbListJsonLd,
  medicalClinicJsonLd,
  renderJsonLd,
  reviewJsonLd,
} from "@/lib/seo";
import {
  getClinicProfile,
  getClinicReviews,
  getPublishedClinicSlugs,
  getRelatedClinics,
  type ReviewSortKey,
} from "@/lib/public-data";
import { formatPrice, formatCount, getInitials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { RatingStars, SubRatings } from "@/components/ui/rating-stars";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ConsultationDialog } from "@/components/lead/consultation-dialog";
import { SaveButton } from "@/components/shortlist/save-button";
import { ShareButton } from "@/components/clinic/share-button";
import { ProfileSubnav, type SubnavItem } from "@/components/clinic/profile-subnav";
import { ReviewItem } from "@/components/clinic/review-item";
import { ReviewsControls } from "@/components/clinic/review-controls";
import { ClinicCardGrid } from "@/components/clinic/savable-clinic-card";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { LeadForm } from "@/components/lead/lead-form";

export const revalidate = 600;

const PRICE_MODEL_LABELS: Record<string, string> = {
  per_treatment: "per treatment",
  per_session: "per session",
  package: "package",
  consult_to_quote: "consult to quote",
};

export async function generateStaticParams() {
  // Best-effort: if the DB is unavailable at build time, fall back to on-demand
  // rendering (dynamicParams defaults true) rather than failing the build.
  try {
    const slugs = await getPublishedClinicSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const clinic = await getClinicProfile(params.slug);
  if (!clinic) return buildMetadata({ title: "Clinic not found" });
  return buildMetadata({
    title: clinic.name,
    description:
      clinic.tagline ??
      clinic.description?.slice(0, 160) ??
      `${clinic.name} — regenerative-medicine clinic profile, reviews, and pricing.`,
    path: `/clinic/${clinic.slug}`,
    image: clinic.coverUrl ?? clinic.logoUrl,
    type: "profile",
    seo: clinic.raw.seo ?? null,
  });
}

export default async function ClinicProfilePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const clinic = await getClinicProfile(params.slug);
  if (!clinic) notFound();

  const single = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const reviewSort = (single(searchParams.revSort) ?? "recent") as ReviewSortKey;
  const reviewPage = Number(single(searchParams.revPage) ?? "1") || 1;
  const revTreatment = single(searchParams.revTreatment);
  const revCondition = single(searchParams.revCondition);

  const [reviews, related] = await Promise.all([
    getClinicReviews(clinic.id, {
      page: reviewPage,
      sort: reviewSort,
      treatment: revTreatment,
      condition: revCondition,
    }),
    getRelatedClinics(clinic.raw, 3),
  ]);

  const hq =
    clinic.locations.find((l) => l.isHQ) ?? clinic.locations[0] ?? null;
  const hqLabel = hq
    ? [hq.city, hq.country].filter(Boolean).join(", ")
    : undefined;

  const dialogConditions = clinic.conditions.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // Build the sticky subnav from sections actually present.
  const subnavItems: SubnavItem[] = [
    { id: "overview", label: "Overview" },
    { id: "treatments", label: "Treatments" },
    clinic.accreditations.length
      ? { id: "accreditations", label: "Accreditations" }
      : null,
    { id: "pricing", label: "Pricing" },
    { id: "reviews", label: "Reviews" },
    clinic.caseStudies.length ? { id: "case-studies", label: "Case studies" } : null,
    clinic.medicalDirector || clinic.team.length
      ? { id: "team", label: "Team" }
      : null,
    { id: "verification", label: "Verification" },
    clinic.locations.length ? { id: "location", label: "Location" } : null,
    { id: "contact", label: "Contact" },
  ].filter((x): x is SubnavItem => x != null);

  const priceLabel =
    clinic.priceMin != null && clinic.priceModel !== "consult_to_quote"
      ? formatPrice(clinic.priceMin, { currency: clinic.currency })
      : null;

  const jsonLd = [
    medicalClinicJsonLd(clinic.raw),
    breadcrumbListJsonLd([
      { name: "Home", path: "/" },
      { name: "Clinics", path: "/clinics" },
      { name: clinic.name, path: `/clinic/${clinic.slug}` },
    ]),
    ...reviews.reviews.slice(0, 5).map((r) =>
      reviewJsonLd({
        reviewer: { isAnonymous: r.displayName === "Verified Patient", displayName: r.displayName },
        ratingOverall: r.ratingOverall,
        headline: r.headline,
        body: r.body,
        createdAt: new Date(r.createdAt),
        clinicName: clinic.name,
      } as Parameters<typeof reviewJsonLd>[0]),
    ),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderJsonLd(jsonLd) }}
      />

      {/* Header */}
      <div className="border-b border-border bg-surface">
        <div className="container py-6 md:py-8">
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1 text-[13px] text-text-muted">
              <li>
                <Link href="/" className="hover:text-text-secondary">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <Link href="/clinics" className="hover:text-text-secondary">
                  Clinics
                </Link>
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span className="text-text-secondary">{clinic.name}</span>
              </li>
            </ol>
          </nav>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-tint font-display text-xl font-bold text-azure-700">
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
                    {clinic.name}
                  </h1>
                  {clinic.badge ? <VerifiedBadge badge={clinic.badge} /> : null}
                </div>
                {clinic.tagline ? (
                  <p className="mt-1 text-[15px] text-text-secondary">
                    {clinic.tagline}
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-text-secondary">
                  {clinic.reviewCount > 0 ? (
                    <a href="#reviews">
                      <RatingStars
                        value={clinic.ratingAvg}
                        reviewCount={clinic.reviewCount}
                      />
                    </a>
                  ) : (
                    <span className="text-text-muted">No reviews yet</span>
                  )}
                  {hqLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {hqLabel}
                    </span>
                  ) : null}
                  {clinic.foundedYear ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      Founded {clinic.foundedYear}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ConsultationDialog
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                source={`profile:${clinic.slug}`}
              />
              {clinic.website ? (
                <Button variant="secondary" asChild>
                  <a
                    href={`/r/${clinic.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <ExternalLink className="size-[18px]" aria-hidden="true" />
                    Visit website
                  </a>
                </Button>
              ) : null}
              <SaveButton slug={clinic.slug} name={clinic.name} />
              <ShareButton title={clinic.name} />
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <ProfileSubnav items={subnavItems} />
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* Main column */}
        <div className="min-w-0 space-y-12">
          {/* Overview */}
          <section id="overview" className="scroll-mt-32">
            {clinic.coverUrl ? (
              <div className="relative mb-5 aspect-[16/7] overflow-hidden rounded-xl border border-border bg-tint">
                <Image
                  src={clinic.coverUrl}
                  alt={clinic.coverAlt ?? `${clinic.name} facility`}
                  fill
                  sizes="(min-width: 1024px) 700px, 100vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : null}
            <h2 className="font-display text-xl font-semibold text-text-primary">
              About {clinic.name}
            </h2>
            {clinic.description ? (
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-text-secondary">
                {clinic.description}
              </p>
            ) : null}

            {clinic.highlights.length ? (
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {clinic.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[14px] text-text-secondary">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Quick facts */}
            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-alt p-4 sm:grid-cols-4">
              <Fact icon={<Building2 className="size-4" />} label="Team size" value={clinic.teamSize} />
              <Fact
                icon={<Stethoscope className="size-4" />}
                label="Physicians"
                value={clinic.physiciansCount ? String(clinic.physiciansCount) : undefined}
              />
              <Fact
                icon={<Languages className="size-4" />}
                label="Languages"
                value={clinic.languages.length ? clinic.languages.join(", ") : undefined}
              />
              <Fact
                icon={<MapPin className="size-4" />}
                label="Locations"
                value={String(clinic.locations.length)}
              />
            </dl>

            {clinic.gallery.length ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {clinic.gallery.slice(0, 6).map((g, i) => (
                  <div
                    key={i}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-tint"
                  >
                    <Image
                      src={g.url}
                      alt={g.alt ?? `${clinic.name} photo ${i + 1}`}
                      fill
                      sizes="(min-width: 640px) 220px, 50vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {/* Treatments & focus */}
          <section id="treatments" className="scroll-mt-32">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Treatments &amp; focus
            </h2>

            {clinic.serviceFocus.length ? (
              <div className="mt-4 space-y-2.5">
                {clinic.serviceFocus.map((f) => (
                  <div key={f.name} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-[13.5px] text-text-secondary">
                      {f.name}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${f.percent}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right font-display text-[13px] font-semibold text-text-primary">
                      {f.percent}%
                    </span>
                  </div>
                ))}
              </div>
            ) : clinic.treatments.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {clinic.treatments.map((t) => (
                  <Link key={t.id} href={`/treatments/${t.slug}`}>
                    <Chip className="hover:border-border-strong">{t.name}</Chip>
                  </Link>
                ))}
              </div>
            ) : null}

            {clinic.cellSources.length ? (
              <div className="mt-5">
                <h3 className="text-[13px] font-semibold text-text-primary">Cell sources</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {clinic.cellSources.map((c) => (
                    <Chip key={c.id} size="sm">
                      {c.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            {clinic.conditions.length ? (
              <div className="mt-5">
                <h3 className="text-[13px] font-semibold text-text-primary">Conditions treated</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {clinic.conditions.map((c) => (
                    <Link key={c.id} href={`/conditions/${c.slug}`}>
                      <Chip className="hover:border-border-strong">{c.name}</Chip>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* Accreditations */}
          {clinic.accreditations.length ? (
            <section id="accreditations" className="scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Accreditations &amp; certifications
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {clinic.accreditations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
                  >
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-display text-[14px] font-semibold text-text-primary">
                        {a.name}
                      </p>
                      {a.issuingBody ? (
                        <p className="text-[12.5px] text-text-muted">{a.issuingBody}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <DisclaimerNote variant="medical" className="mt-4">
                Accreditations are records-based and do not imply endorsement of
                any treatment&apos;s safety or efficacy.
              </DisclaimerNote>
            </section>
          ) : null}

          {/* Pricing */}
          <section id="pricing" className="scroll-mt-32">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Pricing snapshot
            </h2>
            <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <div>
                  <p className="text-[12px] text-text-muted">Starting from</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.01em] text-text-primary">
                    {priceLabel ?? "On consultation"}
                  </p>
                  {clinic.priceModel ? (
                    <p className="text-[12.5px] text-text-muted">
                      {PRICE_MODEL_LABELS[clinic.priceModel] ?? clinic.priceModel}
                    </p>
                  ) : null}
                </div>
                {clinic.priceMax != null ? (
                  <div>
                    <p className="text-[12px] text-text-muted">Typical range</p>
                    <p className="font-display text-lg font-semibold text-text-primary">
                      {formatPrice(clinic.priceMin ?? 0, { currency: clinic.currency })} –{" "}
                      {formatPrice(clinic.priceMax, { currency: clinic.currency })}
                    </p>
                  </div>
                ) : null}
                {clinic.ratingBreakdown?.value ? (
                  <div>
                    <p className="text-[12px] text-text-muted">Value rating</p>
                    <RatingStars value={clinic.ratingBreakdown.value} showValue size={15} />
                  </div>
                ) : null}
              </div>
              {clinic.priceNote ? (
                <p className="mt-3 text-[13.5px] text-text-secondary">{clinic.priceNote}</p>
              ) : null}
              <DisclaimerNote variant="pricing" className="mt-4" />
            </div>
          </section>

          {/* Reviews */}
          <section id="reviews" className="scroll-mt-32">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Patient reviews
              </h2>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/reviews/new?clinic=${clinic.slug}`}>Write a review</Link>
              </Button>
            </div>

            {clinic.reviewCount > 0 ? (
              <div className="mt-4 grid gap-5 rounded-xl border border-border bg-surface p-5 shadow-card sm:grid-cols-[auto_1fr]">
                <div className="text-center sm:border-r sm:border-border sm:pr-6">
                  <div className="font-display text-4xl font-bold text-text-primary">
                    {clinic.ratingAvg.toFixed(1)}
                  </div>
                  <RatingStars
                    value={clinic.ratingAvg}
                    showValue={false}
                    className="mt-1 justify-center"
                  />
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    {formatCount(clinic.reviewCount)}{" "}
                    {clinic.reviewCount === 1 ? "review" : "reviews"}
                  </p>
                </div>
                <SubRatings breakdown={clinic.ratingBreakdown} />
              </div>
            ) : null}

            {clinic.topMentions.length ? (
              <div className="mt-4">
                <p className="text-[13px] font-semibold text-text-primary">
                  What patients mention
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {clinic.topMentions.map((m) => (
                    <Chip key={m.tag} size="sm">
                      {m.tag} ({m.count})
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            <DisclaimerNote variant="results" className="mt-4" />

            {reviews.total > 0 ? (
              <div className="mt-5 flex justify-end">
                <ReviewsControls
                  treatments={clinic.treatments.map((t) => ({ slug: t.slug, name: t.name }))}
                  conditions={clinic.conditions.map((c) => ({ slug: c.slug, name: c.name }))}
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {reviews.reviews.length ? (
                reviews.reviews.map((r) => <ReviewItem key={r.id} review={r} />)
              ) : (
                <EmptyState
                  icon={Quote}
                  title="No reviews yet"
                  description="Be the first to share your experience with this clinic."
                  action={
                    <Button asChild>
                      <Link href={`/reviews/new?clinic=${clinic.slug}`}>Write a review</Link>
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
                hrefFor={(p) => {
                  const sp = new URLSearchParams();
                  for (const [k, v] of Object.entries(searchParams)) {
                    if (k === "revPage") continue;
                    if (typeof v === "string") sp.set(k, v);
                  }
                  if (p > 1) sp.set("revPage", String(p));
                  const qs = sp.toString();
                  return `/clinic/${clinic.slug}${qs ? `?${qs}` : ""}#reviews`;
                }}
              />
            ) : null}
          </section>

          {/* Case studies */}
          {clinic.caseStudies.length ? (
            <section id="case-studies" className="scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Case studies
              </h2>
              <div className="mt-4 space-y-4">
                {clinic.caseStudies.map((cs, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-5 shadow-card">
                    <h3 className="font-display text-[15px] font-semibold text-text-primary">
                      {cs.title}
                    </h3>
                    {cs.conditionName ? (
                      <Chip size="sm" className="mt-2">
                        {cs.conditionName}
                      </Chip>
                    ) : null}
                    {cs.summary ? (
                      <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                        {cs.summary}
                      </p>
                    ) : null}
                    {cs.outcome ? (
                      <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                        <span className="font-semibold text-text-primary">Outcome: </span>
                        {cs.outcome}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <DisclaimerNote variant="results" className="mt-4" />
            </section>
          ) : null}

          {/* Team */}
          {clinic.medicalDirector || clinic.team.length ? (
            <section id="team" className="scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Team
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[clinic.medicalDirector, ...clinic.team]
                  .filter((p): p is NonNullable<typeof p> => Boolean(p))
                  .map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint font-display text-sm font-bold text-azure-700">
                        {getInitials(p.name)}
                      </span>
                      <div>
                        <p className="font-display text-[14px] font-semibold text-text-primary">
                          {p.name}
                        </p>
                        {p.title ? (
                          <p className="text-[12.5px] text-text-secondary">{p.title}</p>
                        ) : null}
                        {p.credentials ? (
                          <p className="text-[12px] text-text-muted">{p.credentials}</p>
                        ) : null}
                        {p.bio ? (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                            {p.bio}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {/* Verification */}
          <section id="verification" className="scroll-mt-32">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Verification
            </h2>
            <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className={clinic.isVerified ? "size-6 text-primary" : "size-6 text-text-muted"}
                  aria-hidden="true"
                />
                <div>
                  <p className="font-display text-[15px] font-semibold text-text-primary">
                    {clinic.isVerified
                      ? `${clinic.name} is ${clinic.badge === "premier" ? "Premier verified" : "verified"}`
                      : "Not yet verified"}
                  </p>
                  <p className="mt-1 text-[13.5px] text-text-secondary">
                    {clinic.isVerified
                      ? clinic.verificationMethod ??
                        "Verification is based on accreditation and record checks."
                      : "This clinic has not completed verification. Listings are still curated, but accreditation hasn't been confirmed."}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[13.5px] text-text-secondary">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                      {clinic.accreditations.length} accreditation
                      {clinic.accreditations.length === 1 ? "" : "s"} on file
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                      {formatCount(clinic.reviewCount)} verified-eligible review
                      {clinic.reviewCount === 1 ? "" : "s"}
                    </li>
                  </ul>
                  <Link
                    href="/methodology"
                    className="mt-3 inline-block text-[13px] font-semibold text-text-link hover:underline"
                  >
                    How verification works
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Location */}
          {clinic.locations.length ? (
            <section id="location" className="scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Location
              </h2>
              <div className="mt-4 space-y-4">
                {clinic.locations.map((loc, i) => {
                  const addr = [loc.addressLine, loc.city, loc.region, loc.country, loc.postalCode]
                    .filter(Boolean)
                    .join(", ");
                  const mapQuery =
                    loc.lat != null && loc.lng != null
                      ? `${loc.lat},${loc.lng}`
                      : addr || `${clinic.name}`;
                  return (
                    <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                      <iframe
                        title={`Map of ${clinic.name}${loc.city ? ` in ${loc.city}` : ""}`}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=12&output=embed`}
                        className="h-56 w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="flex items-start gap-2 text-[13.5px] text-text-secondary">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>
                            {addr || "Address available on request"}
                            {loc.isHQ ? (
                              <span className="ml-2 rounded-sm bg-tint px-1.5 py-0.5 text-[11px] font-semibold text-azure-700">
                                HQ
                              </span>
                            ) : null}
                          </span>
                        </div>
                        {loc.phone ? (
                          <a
                            href={`tel:${loc.phone}`}
                            className="text-[13.5px] font-semibold text-text-link hover:underline"
                          >
                            {loc.phone}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Contact */}
          <section id="contact" className="scroll-mt-32">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Request a consultation
            </h2>
            <p className="mt-2 text-[14px] text-text-secondary">
              Share a few details and {clinic.name} will reach out by email. Your
              information is never shown publicly.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
              <ConsultationInline
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                slug={clinic.slug}
              />
            </div>
          </section>

          {/* Related clinics */}
          {related.length ? (
            <section className="scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Similar clinics
              </h2>
              <div className="mt-4">
                <ClinicCardGrid clinics={related} columns={1} />
              </div>
            </section>
          ) : null}
        </div>

        {/* Sticky CTA rail */}
        <aside className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="font-display text-base font-semibold text-text-primary">
              Interested in {clinic.name}?
            </p>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              Request a consultation — no obligation.
            </p>
            <div className="mt-4 space-y-2.5">
              <ConsultationDialog
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                source={`profile-rail:${clinic.slug}`}
                trigger={
                  <Button className="w-full">
                    <MessageSquareText className="size-[18px]" aria-hidden="true" />
                    Request a consultation
                  </Button>
                }
              />
              {clinic.website ? (
                <Button variant="secondary" asChild className="w-full">
                  <a
                    href={`/r/${clinic.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <Globe className="size-[18px]" aria-hidden="true" />
                    Visit website
                  </a>
                </Button>
              ) : null}
              <SaveButton slug={clinic.slug} name={clinic.name} className="w-full" />
            </div>
          </div>
          <DisclaimerNote variant="medical" className="mt-4" />
        </aside>
      </div>
    </>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[12px] text-text-muted">
        <span className="text-text-muted">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-[14px] font-semibold text-text-primary">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function ConsultationInline({
  clinicId,
  clinicName,
  conditions,
}: {
  clinicId: string;
  clinicName: string;
  conditions: { id: string; name: string }[];
  slug: string;
}) {
  return (
    <LeadForm
      type="consultation"
      clinicId={clinicId}
      clinicName={clinicName}
      conditions={conditions}
      source="profile-contact"
    />
  );
}

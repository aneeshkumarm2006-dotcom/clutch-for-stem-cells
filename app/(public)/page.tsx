import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  MessageSquareText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
} from "lucide-react";

import { organizationJsonLd, renderJsonLd, websiteJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";
import { getHomeData } from "@/lib/public-data";
import { getPublishedBlogPosts } from "@/lib/seoteam/blog-data";
import { formatCount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SearchBar } from "@/components/search/search-bar";
import { Section, SectionHeader } from "@/components/common/section";
import { ClinicCardGrid } from "@/components/clinic/savable-clinic-card";
import { TaxonomyCard, DestinationCard } from "@/components/taxonomy/taxonomy-card";
import { BlogCard } from "@/components/blog/blog-card";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";

export const revalidate = 600;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ path: "/" });
}

export default async function HomePage() {
  const [home, blog] = await Promise.all([
    getHomeData(),
    getPublishedBlogPosts({ page: 1 }),
  ]);
  const latestPosts = blog.posts.slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: renderJsonLd([organizationJsonLd(), websiteJsonLd()]),
        }}
      />

      {/* Hero — Design §5.3 */}
      <section
        className="border-b border-border"
        style={{
          background:
            "radial-gradient(120% 85% at 50% -12%, #E1F0FC, #F2F8FD 60%)",
        }}
      >
        <div className="container flex flex-col items-center py-16 text-center md:py-24">
          <h1 className="max-w-3xl font-display text-[clamp(27px,5vw,38px)] font-bold leading-[1.08] tracking-[-0.025em] text-text-primary">
            {home.hero.headline}
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-text-secondary">
            {home.hero.subhead}
          </p>

          <SearchBar className="mt-8" />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/find-a-clinic">{home.hero.ctaPrimaryLabel}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/clinics">{home.hero.ctaSecondaryLabel}</Link>
            </Button>
          </div>

          {home.popularSearches.length ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[13px] text-text-muted">Popular:</span>
              {home.popularSearches.map((p) => (
                <Link key={`${p.label}-${p.href}`} href={p.href}>
                  <Chip className="hover:border-border-strong">{p.label}</Chip>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="container">
        {/* Browse by treatment */}
        {home.treatments.length ? (
          <Section>
            <SectionHeader
              title="Browse by treatment"
              description="Explore clinics by the regenerative therapy you're researching."
              link={{ href: "/treatments", label: "All treatments" }}
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.treatments.slice(0, 9).map((t) => (
                <TaxonomyCard key={t.id} term={t} basePath="/treatments" />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Browse by condition */}
        {home.conditions.length ? (
          <Section className="border-t border-border">
            <SectionHeader
              title="Browse by condition"
              description="Find clinics that treat the condition you care about."
              link={{ href: "/conditions", label: "All conditions" }}
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.conditions.slice(0, 9).map((c) => (
                <TaxonomyCard key={c.id} term={c} basePath="/conditions" />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Browse by destination */}
        {home.countries.length ? (
          <Section className="border-t border-border">
            <SectionHeader
              title="Browse by destination"
              description="Popular medical-travel destinations for regenerative care."
              link={{ href: "/locations", label: "All destinations" }}
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {home.countries.slice(0, 8).map((c) => (
                <DestinationCard
                  key={c.id}
                  name={c.name}
                  slug={c.slug}
                  flag={c.flag}
                  clinicCount={c.clinicCount}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Featured clinics */}
        {home.featuredClinics.length ? (
          <Section className="border-t border-border">
            <SectionHeader
              eyebrow="Featured"
              title="Top-rated clinics"
              description="A mix of editor-curated and highly rated verified clinics. Featured placement is labelled and explained on our methodology page."
              link={{ href: "/clinics", label: "Browse all clinics" }}
            />
            <div className="mt-7">
              <ClinicCardGrid clinics={home.featuredClinics} columns={2} />
            </div>
          </Section>
        ) : null}
      </div>

      {/* How it works */}
      <Section className="bg-surface-alt">
        <div className="container">
          <SectionHeader
            title="How it works"
            description="Three steps from research to a confident decision."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <HowItWorksStep
              icon={<Search className="size-5" />}
              step="1"
              title="Browse"
              body="Search and filter clinics by treatment, condition, location, price, and verified reviews."
            />
            <HowItWorksStep
              icon={<SlidersHorizontal className="size-5" />}
              step="2"
              title="Compare"
              body="Review profiles, accreditations, pricing, and real patient experiences side by side."
            />
            <HowItWorksStep
              icon={<MessageSquareText className="size-5" />}
              step="3"
              title="Connect"
              body="Request a consultation or get matched with clinics that fit your needs."
            />
          </div>
        </div>
      </Section>

      {/* Trust strip */}
      <Section className="border-y border-border">
        <div className="container">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint px-2.5 py-1 text-xs font-semibold text-azure-700">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Verification you can check
              </span>
              <h2 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
                Curated listings and verified patient reviews
              </h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-text-secondary">
                Verification is based on accreditation and record checks — it is
                not an endorsement of any treatment&apos;s safety or efficacy.
                Learn how clinics are ranked and verified.
              </p>
              <Button asChild variant="ghost" className="mt-4 px-0">
                <Link href="/methodology">
                  Read our methodology
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Stat value={formatCount(home.stats.clinics)} label="Clinics" />
              <Stat
                value={formatCount(home.stats.verified)}
                label="Verified"
              />
              <Stat
                value={formatCount(home.stats.reviews)}
                label="Patient reviews"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      {home.testimonials.length ? (
        <Section>
          <div className="container">
            <SectionHeader
              title="What patients say"
              description="Experiences shared by patients who used StemConnect to research clinics."
            />
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {home.testimonials.slice(0, 3).map((t, i) => (
                <figure
                  key={i}
                  className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card"
                >
                  {t.rating ? (
                    <div className="mb-3 flex gap-0.5" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={
                            s < (t.rating ?? 0)
                              ? "size-4 fill-star text-star"
                              : "size-4 fill-slate-300 text-slate-300"
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-text-primary">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  {t.author ? (
                    <figcaption className="mt-4 text-[13px] text-text-secondary">
                      <span className="font-semibold text-text-primary">
                        {t.author}
                      </span>
                      {t.location ? ` · ${t.location}` : ""}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
            <DisclaimerNote variant="results" className="mt-6">
              Testimonials reflect individual experiences. Individual results
              vary and are not typical or guaranteed.
            </DisclaimerNote>
          </div>
        </Section>
      ) : null}

      {/* For clinics band */}
      <Section className="bg-ink">
        <div className="container">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-br from-azure-700 to-azure-600 p-8 md:flex-row md:items-center md:p-10">
            <div className="max-w-xl">
              <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-white">
                Are you a regenerative-medicine clinic?
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/85">
                Get listed for free, build trust with verification, and receive
                qualified patient inquiries.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="shrink-0">
              <Link href="/for-clinics">
                Get listed
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* Blog teaser */}
      {latestPosts.length ? (
        <Section>
          <div className="container">
            <SectionHeader
              title="From the blog"
              description="Guides, updates, and insights to help you research regenerative medicine."
              link={{ href: "/blog", label: "All blog posts" }}
            />
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {latestPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}

function HowItWorksStep({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-tint text-azure-700">
          {icon}
        </span>
        <span className="font-display text-sm font-semibold text-text-muted">
          Step {step}
        </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-text-primary">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
        {body}
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center shadow-card sm:p-5">
      <div className="font-display text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[26px]">
        {value}
      </div>
      <div className="mt-1 text-[12.5px] text-text-muted">{label}</div>
    </div>
  );
}

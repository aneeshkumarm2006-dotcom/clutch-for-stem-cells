import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Calendar,
  Check,
  Heart,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { faqPageJsonLd, itemListJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { getHomeData } from "@/lib/public-data";
import { getHomepageContent } from "@/lib/homepage";
import { getPublishedBlogPosts } from "@/lib/seoteam/blog-data";
import { formatCount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SearchBar } from "@/components/search/search-bar";
import { Section, SectionHeader } from "@/components/common/section";
import { ClinicCardGrid } from "@/components/clinic/savable-clinic-card";
import {
  TaxonomyCard,
  DestinationCard,
} from "@/components/taxonomy/taxonomy-card";
import { BlogCard } from "@/components/blog/blog-card";
import { FaqSection } from "@/components/content/faq-section";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import type { HomepageColumn } from "@/config/homepage";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  // Title, description, OG and robots ship from `config/static-pages.ts` and are
  // overridable per-route from the SEO panel of /admin/content/homepage (stored
  // in `SiteSetting.pageSeo`). Keywords are homepage-only, so they live with the
  // rest of its content.
  const [meta, content] = await Promise.all([
    pageMetadata({ path: "/" }),
    getHomepageContent(),
  ]);
  return {
    ...meta,
    // Head terms only. The long-tails (knee arthritis, MSC, autologous,
    // umbilical-cord, systemic) are ranking targets for their own taxonomy
    // pages — the homepage links to them rather than competing with them.
    keywords: content.keywords,
  };
}

/** The icons an editor can pick for a "how it works" step. */
const STEP_ICONS: Record<string, LucideIcon> = {
  search: Search,
  sliders: SlidersHorizontal,
  message: MessageSquareText,
  shield: ShieldCheck,
  star: Star,
  heart: Heart,
  stethoscope: Stethoscope,
  "map-pin": MapPin,
  calendar: Calendar,
  check: Check,
  users: Users,
  sparkles: Sparkles,
};

export default async function HomePage() {
  const home = await getHomeData();
  const c = home.content;
  const blog = c.blog.enabled
    ? await getPublishedBlogPosts({ page: 1 })
    : { posts: [] };
  const latestPosts = blog.posts.slice(0, c.blog.limit);

  const heroImage = c.hero.backgroundImage?.url;
  const faqItems = c.faq.items;

  // The five browse sections share one container; the first visible one skips
  // the top divider so the rule always sits *between* sections.
  const browse = [
    c.treatments.enabled && home.treatments.length ? "treatments" : null,
    c.conditions.enabled && home.conditions.length ? "conditions" : null,
    c.highlights.enabled && c.highlights.cards.length ? "highlights" : null,
    c.destinations.enabled && home.countries.length ? "destinations" : null,
    c.featured.enabled && home.featuredClinics.length ? "featured" : null,
  ].filter(Boolean) as string[];
  const divider = (key: string) =>
    browse[0] === key ? undefined : "border-t border-border";

  // The homepage graph. `Organization` + `WebSite` come from <BaseSchema> in the
  // layout; what belongs *here* is what this page uniquely shows — the featured
  // clinics as an `ItemList`, and the FAQ block if the editor left it on.
  //
  // On the `ItemList`: it will not draw a carousel, because Google's carousel
  // rich result covers only Recipe/Course/Restaurant/Movie. It earns its place
  // by naming the four entities the homepage promotes, each pointing at the
  // `…#clinic` node its own profile publishes.
  const homeJsonLd = [
    c.featured.enabled && home.featuredClinics.length
      ? itemListJsonLd(
          home.featuredClinics.slice(0, c.featured.limit).map((clinic) => ({
            path: `/clinic/${clinic.slug}`,
            name: clinic.name,
          })),
          {
            name: c.featured.title,
            path: "/",
            itemType: "MedicalClinic",
            itemIdFragment: "clinic",
          },
        )
      : null,
    c.faq.emitJsonLd && faqItems.length ? faqPageJsonLd(faqItems, "/") : null,
  ].filter((n): n is NonNullable<typeof n> => n != null);

  return (
    <>
      {/* Organization + WebSite JSON-LD now come from <BaseSchema> in the public
          layout, so every page carries them — not just the homepage. */}
      {homeJsonLd.length ? <JsonLd data={homeJsonLd} /> : null}

      {/* Hero — Design §5.3 */}
      <section
        className="border-b border-border"
        style={
          heroImage
            ? {
                // The wash keeps the headline readable over whatever image an
                // editor picks, without hardcoding an assumption about it.
                backgroundImage: `linear-gradient(rgba(242,248,253,0.82), rgba(242,248,253,0.82)), url("${heroImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background:
                  "radial-gradient(120% 85% at 50% -12%, #E1F0FC, #F2F8FD 60%)",
              }
        }
      >
        <div className="container flex flex-col items-center py-16 text-center md:py-24">
          <h1 className="max-w-3xl font-display text-[clamp(27px,5vw,38px)] font-bold leading-[1.08] tracking-[-0.025em] text-text-primary">
            {c.hero.headline}
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-text-secondary">
            {c.hero.subhead}
          </p>

          {c.hero.showSearch ? <SearchBar className="mt-8" /> : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {c.hero.ctaPrimaryLabel ? (
              <Button asChild size="lg">
                <Link href={c.hero.ctaPrimaryHref}>
                  {c.hero.ctaPrimaryLabel}
                </Link>
              </Button>
            ) : null}
            {c.hero.ctaSecondaryLabel ? (
              <Button asChild size="lg" variant="secondary">
                <Link href={c.hero.ctaSecondaryHref}>
                  {c.hero.ctaSecondaryLabel}
                </Link>
              </Button>
            ) : null}
          </div>

          {c.popularSearches.length ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {c.hero.popularLabel ? (
                <span className="text-[13px] text-text-muted">
                  {c.hero.popularLabel}
                </span>
              ) : null}
              {c.popularSearches.map((p) => (
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
        {browse.includes("treatments") ? (
          <Section className={divider("treatments")}>
            <SectionHeader
              eyebrow={c.treatments.eyebrow || undefined}
              title={c.treatments.title}
              description={c.treatments.description}
              link={
                c.treatments.linkLabel
                  ? {
                      href: c.treatments.linkHref,
                      label: c.treatments.linkLabel,
                    }
                  : undefined
              }
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.treatments.slice(0, c.treatments.limit).map((t) => (
                <TaxonomyCard key={t.id} term={t} basePath="/treatments" />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Browse by condition */}
        {browse.includes("conditions") ? (
          <Section className={divider("conditions")}>
            <SectionHeader
              eyebrow={c.conditions.eyebrow || undefined}
              title={c.conditions.title}
              description={c.conditions.description}
              link={
                c.conditions.linkLabel
                  ? {
                      href: c.conditions.linkHref,
                      label: c.conditions.linkLabel,
                    }
                  : undefined
              }
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.conditions.slice(0, c.conditions.limit).map((t) => (
                <TaxonomyCard key={t.id} term={t} basePath="/conditions" />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Highlight cards — the most-searched cluster, given its own entry points */}
        {browse.includes("highlights") ? (
          <Section className={divider("highlights")}>
            <SectionHeader
              eyebrow={c.highlights.eyebrow || undefined}
              title={c.highlights.title}
              description={c.highlights.description}
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.highlights.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong"
                >
                  <h3 className="font-display text-[15px] font-semibold text-text-primary">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {card.body}
                  </p>
                </Link>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Browse by destination */}
        {browse.includes("destinations") ? (
          <Section className={divider("destinations")}>
            <SectionHeader
              eyebrow={c.destinations.eyebrow || undefined}
              title={c.destinations.title}
              description={c.destinations.description}
              link={
                c.destinations.linkLabel
                  ? {
                      href: c.destinations.linkHref,
                      label: c.destinations.linkLabel,
                    }
                  : undefined
              }
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {home.countries.slice(0, c.destinations.limit).map((country) => (
                <DestinationCard
                  key={country.id}
                  name={country.name}
                  slug={country.slug}
                  flag={country.flag}
                  clinicCount={country.clinicCount}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Featured clinics */}
        {browse.includes("featured") ? (
          <Section className={divider("featured")}>
            <SectionHeader
              eyebrow={c.featured.eyebrow || undefined}
              title={c.featured.title}
              description={c.featured.description}
              link={
                c.featured.linkLabel
                  ? { href: c.featured.linkHref, label: c.featured.linkLabel }
                  : undefined
              }
            />
            <div className="mt-7">
              <ClinicCardGrid clinics={home.featuredClinics} columns={2} />
            </div>
          </Section>
        ) : null}
      </div>

      {/* How it works */}
      {c.howItWorks.enabled && c.howItWorks.steps.length ? (
        <Section className="bg-surface-alt">
          <div className="container">
            <SectionHeader
              eyebrow={c.howItWorks.eyebrow || undefined}
              title={c.howItWorks.title}
              description={c.howItWorks.description}
            />
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {c.howItWorks.steps.map((step, i) => (
                <HowItWorksStep
                  key={`${step.title}-${i}`}
                  icon={step.icon}
                  step={String(i + 1)}
                  title={step.title}
                  body={step.body}
                />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* Cost & benefits — the two questions every visitor arrives with */}
      {c.costBenefits.enabled ? (
        <Section>
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-2">
              {c.costBenefits.columns.map((col, i) => (
                <CostBenefitColumn key={i} column={col} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* Trust strip */}
      {c.trust.enabled ? (
        <Section className="border-y border-border">
          <div className="container">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                {c.trust.badge ? (
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint px-2.5 py-1 text-xs font-semibold text-azure-700">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    {c.trust.badge}
                  </span>
                ) : null}
                <h2 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
                  {c.trust.title}
                </h2>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-text-secondary">
                  {c.trust.body}
                </p>
                {c.trust.ctaLabel ? (
                  <Button asChild variant="ghost" className="mt-4 px-0">
                    <Link href={c.trust.ctaHref}>
                      {c.trust.ctaLabel}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : null}
              </div>
              {c.trust.showStats ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <Stat
                    value={formatCount(home.stats.clinics)}
                    label={c.trust.clinicsLabel}
                  />
                  <Stat
                    value={formatCount(home.stats.verified)}
                    label={c.trust.verifiedLabel}
                  />
                  <Stat
                    value={formatCount(home.stats.reviews)}
                    label={c.trust.reviewsLabel}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      {/* Testimonials */}
      {c.testimonials.enabled && c.testimonials.items.length ? (
        <Section>
          <div className="container">
            <SectionHeader
              eyebrow={c.testimonials.eyebrow || undefined}
              title={c.testimonials.title}
              description={c.testimonials.description}
            />
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {c.testimonials.items.slice(0, 3).map((t, i) => (
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
            {c.testimonials.note ? (
              <DisclaimerNote variant="results" className="mt-6">
                {c.testimonials.note}
              </DisclaimerNote>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* For clinics band */}
      {c.forClinics.enabled ? (
        <Section className="bg-ink">
          <div className="container">
            <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-br from-azure-700 to-azure-600 p-8 md:flex-row md:items-center md:p-10">
              <div className="max-w-xl">
                <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-white">
                  {c.forClinics.title}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-white/85">
                  {c.forClinics.body}
                </p>
              </div>
              {c.forClinics.ctaLabel ? (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="shrink-0"
                >
                  <Link href={c.forClinics.ctaHref}>
                    {c.forClinics.ctaLabel}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      {/* FAQ — paired with the FAQPage JSON-LD emitted at the top of this page */}
      {c.faq.enabled && faqItems.length ? (
        <Section className="bg-surface-alt">
          <div className="container max-w-3xl">
            <FaqSection items={faqItems} heading={c.faq.heading} />
            {c.faq.moreLabel ? (
              <Button asChild variant="ghost" className="mt-4 px-0">
                <Link href={c.faq.moreHref}>
                  {c.faq.moreLabel}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Blog teaser */}
      {c.blog.enabled && latestPosts.length ? (
        <Section>
          <div className="container">
            <SectionHeader
              eyebrow={c.blog.eyebrow || undefined}
              title={c.blog.title}
              description={c.blog.description}
              link={
                c.blog.linkLabel
                  ? { href: c.blog.linkHref, label: c.blog.linkLabel }
                  : undefined
              }
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

function CostBenefitColumn({ column }: { column: HomepageColumn }) {
  return (
    <div>
      <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
        {column.title}
      </h2>
      {column.intro ? (
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {column.intro}
        </p>
      ) : null}
      {column.bullets.length ? (
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-text-secondary">
          {column.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary" aria-hidden="true">
                •
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {column.outro ? (
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {column.outro}
        </p>
      ) : null}
      {column.ctaLabel ? (
        <Button asChild variant="ghost" className="mt-3 px-0">
          <Link href={column.ctaHref}>
            {column.ctaLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
      {column.disclaimer !== "none" ? (
        <DisclaimerNote variant={column.disclaimer} className="mt-4" />
      ) : null}
    </div>
  );
}

function HowItWorksStep({
  icon,
  step,
  title,
  body,
}: {
  icon: string;
  step: string;
  title: string;
  body: string;
}) {
  const Icon = STEP_ICONS[icon] ?? Check;
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-tint text-azure-700">
          <Icon className="size-5" />
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

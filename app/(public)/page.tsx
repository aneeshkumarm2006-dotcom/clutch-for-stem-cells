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

import { pageMetadata } from "@/lib/page-metadata";
import { faqPageJsonLd, renderJsonLd } from "@/lib/seo";
import { getHomeData } from "@/lib/public-data";
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
import { FaqSection, type FaqItem } from "@/components/content/faq-section";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const meta = await pageMetadata({
    path: "/",
    title: "Stem Cell Guide",
    description:
      "Compare stem cell treatment options, costs and benefits across verified clinics: MSC, autologous, bone-marrow-derived, umbilical-cord and systemic cell therapy.",
  });
  return {
    ...meta,
    // Head terms only. The long-tails (knee arthritis, MSC, autologous,
    // umbilical-cord, systemic) are ranking targets for their own taxonomy
    // pages — the homepage links to them rather than competing with them.
    keywords: [
      "stem cell guide",
      "stem cell treatment",
      "stem cell therapy",
      "stem cell cost",
      "stem cell treatment price",
      "stem cell benefits",
      "stem cell treatment benefits",
    ],
  };
}

/** Home FAQ — mirrors the highest-volume research questions and is emitted as
 *  FAQPage JSON-LD so answer engines can quote a passage directly. */
const HOME_FAQS: FaqItem[] = [
  {
    question: "How much does stem cell treatment cost?",
    answer:
      "There is no single stem cell treatment price. Cost follows the cell source, how many sessions a protocol needs, and the country you travel to — a single knee injection sits at the low end, a multi-day systemic protocol with follow-up at the high end. Each listing shows the clinic's own indicative starting price, and you can filter the directory by budget.",
  },
  {
    question: "What are the benefits of stem cell therapy?",
    answer:
      "Most people researching therapy with stem cells are after the same stem cell treatment benefits: less pain, better mobility, and an alternative to surgery. How well the evidence supports that varies by condition and by treatment, so ask a clinic what its protocol has been shown to do, and take the answer to your own physician before booking.",
  },
  {
    question: "Does stem cell therapy help with knee pain?",
    answer:
      "Knees are the most researched use case in this directory. Clinics offering stem cell therapy for knee arthritis typically inject cells into the joint to target pain and stiffness, but research is still developing and outcomes differ between patients. Compare what each clinic actually offers before you commit.",
  },
  {
    question: "What are mesenchymal stem cells?",
    answer:
      "Mesenchymal stem cells (MSCs) are cells sourced from bone marrow, fat tissue, or umbilical cord tissue. They are the cell type behind most MSC therapy listed here, and clinics differ in where they source them and how many cells a protocol uses.",
  },
  {
    question:
      "What is the difference between autologous and umbilical-cord therapy?",
    answer:
      "Autologous therapy uses your own cells, harvested on the day from fat or marrow — bone-marrow-derived therapy is one form of it. Umbilical-cord therapy uses screened donor cells and skips the harvest step. Which one you can access depends on the regulations where the clinic operates.",
  },
  {
    question: "What is systemic cell therapy?",
    answer:
      "Systemic (IV) cell therapy delivers cells into the bloodstream rather than into a single joint, so clinics tend to price it per protocol rather than per injection. It is usually discussed for whole-body or autoimmune concerns rather than one painful knee.",
  },
];

/** Entry points for the knee/joint cluster — every slug is a seeded taxonomy term. */
const KNEE_AND_JOINT_LINKS = [
  {
    title: "Knee osteoarthritis",
    body: "Clinics offering stem cell therapy for knee arthritis, with pricing and patient reviews.",
    href: "/conditions/knee-osteoarthritis",
  },
  {
    title: "Joint pain",
    body: "Stem cell therapy for joint pain in the hip, shoulder, and knee, compared side by side.",
    href: "/conditions/joint-pain",
  },
  {
    title: "Sports injuries",
    body: "Cartilage, ligament, and tendon damage treated with regenerative injections.",
    href: "/conditions/sports-injuries",
  },
  {
    title: "Regenerative orthopedics",
    body: "Image-guided injections into the joint rather than a systemic protocol.",
    href: "/treatments/regenerative-orthopedics",
  },
];

export default async function HomePage() {
  const [home, blog] = await Promise.all([
    getHomeData(),
    getPublishedBlogPosts({ page: 1 }),
  ]);
  const latestPosts = blog.posts.slice(0, 3);

  return (
    <>
      {/* Organization + WebSite JSON-LD now come from <BaseSchema> in the public
          layout, so every page carries them — not just the homepage. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: renderJsonLd(faqPageJsonLd(HOME_FAQS)),
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
              title="Browse by type of stem cell therapy"
              description="Compare clinics offering mesenchymal stem cell (MSC), autologous, bone-marrow-derived, umbilical-cord, and systemic cell therapy."
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
              description="From stem cell therapy for knee arthritis and joint pain to neurological, autoimmune, and anti-aging care."
              link={{ href: "/conditions", label: "All conditions" }}
            />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.conditions.slice(0, 9).map((c) => (
                <TaxonomyCard key={c.id} term={c} basePath="/conditions" />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Knees & joints — the most-searched use case, given its own entry points */}
        <Section className="border-t border-border">
          <SectionHeader
            eyebrow="Most researched"
            title="Stem cell therapy for knees and joints"
            description="Knee pain is what brings most people here. Start with whichever of these is closest to your situation."
          />
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KNEE_AND_JOINT_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong"
              >
                <h3 className="font-display text-[15px] font-semibold text-text-primary">
                  {l.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {l.body}
                </p>
              </Link>
            ))}
          </div>
        </Section>

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

      {/* Cost & benefits — the two questions every visitor arrives with */}
      <Section>
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
                What does stem cell treatment cost?
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                There is no flat stem cell treatment price. Four things move it
                more than anything else:
              </p>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    The cell source — your own cells in autologous or
                    bone-marrow-derived therapy, or screened donor cells in
                    umbilical-cord therapy.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Cell count, and how many sessions the protocol runs to.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    One injection into a single joint versus IV or systemic cell
                    therapy.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    The country, the clinic&apos;s accreditation, and whether
                    travel and aftercare are bundled in.
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                Every listing shows the clinic&apos;s own indicative starting
                price, so you can filter by budget instead of guessing at a
                number.
              </p>
              <Button asChild variant="ghost" className="mt-3 px-0">
                <Link href="/clinics">
                  Compare clinics by price
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <DisclaimerNote variant="pricing" className="mt-4" />
            </div>

            <div>
              <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
                Stem cell benefits, and the honest limits
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                People researching therapy with stem cells tend to want the same
                stem cell treatment benefits: less pain, more movement, and a
                path that isn&apos;t surgery. How strongly the research backs
                that up depends on the condition and on the treatment, and it is
                still developing for most uses.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                So compare on the things you can actually check: what cells a
                clinic uses, what its protocol involves, what it costs, what
                accreditation it holds, and what patients said afterwards. Any
                clinic promising you a certain outcome is telling you something
                useful about itself.
              </p>
              <Button asChild variant="ghost" className="mt-3 px-0">
                <Link href="/methodology">
                  How we verify and rank clinics
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <DisclaimerNote variant="medical" className="mt-4" />
            </div>
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
              <Stat value={formatCount(home.stats.verified)} label="Verified" />
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

      {/* FAQ — paired with the FAQPage JSON-LD emitted at the top of this page */}
      <Section className="bg-surface-alt">
        <div className="container max-w-3xl">
          <FaqSection
            items={HOME_FAQS}
            heading="Stem cell therapy: common questions"
          />
          <Button asChild variant="ghost" className="mt-4 px-0">
            <Link href="/faq">
              More questions about using this guide
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
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

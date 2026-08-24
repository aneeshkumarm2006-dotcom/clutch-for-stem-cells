/**
 * `/clinic/[slug]/cost` — the dedicated pricing page for a clinic.
 *
 * Why "cost" and not "pricing", "prices" or "cost-and-pricing":
 *  - The last path segment is the query itself, which is the same rule the
 *    sibling `/reviews` page follows. People type "<clinic> cost" and "how much
 *    does <clinic> cost" far more than they type "<clinic> pricing", and price
 *    is the single most-searched attribute in this category.
 *  - One word keeps the URL short enough to survive a SERP breadcrumb, and it
 *    matches the section anchor (`#pricing`) the profile already links from.
 *  - The plural and the "pricing" phrasing are carried in the keywords instead
 *    (see `clinicCostKeywords` in lib/clinic-meta.ts), where they cost nothing.
 *
 * Why a child route rather than a bigger `#pricing` section on the profile: the
 * profile's snapshot is one range, and a real cost answer is a table of lines
 * plus what the number does and does not cover, the insurance position, the
 * financing position, and the questions to ask. That is a page, and it is a
 * different query from "<clinic>".
 *
 * Indexation follows the site-wide convention (`lib/seo-indexation.ts`): the
 * clean path is canonical and indexable. Having no price table is deliberately
 * *not* a gate — a clinic that quotes everything privately is itself the answer
 * to "how much does it cost", and the page says so in as many words. The only
 * suppression is the editor's `costPage.seo` toggle.
 *
 * Every piece of copy has an editor override on `Clinic.costPage` (admin →
 * clinic → "Cost page"), and each one is a fallback rather than a replacement:
 * an unset field keeps the derived copy below, which is what a clinic with no
 * `costPage` at all renders.
 */
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  ExternalLink,
  MessageSquareText,
  Minus,
  Receipt,
  ShieldQuestion,
  Star,
  Tag,
  Wallet,
} from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { buildJsonLd } from "@/lib/schema/engine";
import { clinicNodeInput } from "@/lib/schema/adapters";
import { getSchemaContext } from "@/lib/schema/context";
import {
  applyRedirect,
  redirectOrNotFound,
  resolveRedirect,
} from "@/lib/redirects";
import { pageMetadata } from "@/lib/page-metadata";
import {
  clinicCostKeywords,
  clinicCostMetaBoldPrefix,
  clinicCostMetaDescription,
  clinicCostMetaTitle,
} from "@/lib/clinic-meta";
import { renderMarkdown } from "@/lib/markdown";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { getClinicProfile } from "@/lib/public-data";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { RatingStars } from "@/components/ui/rating-stars";
import { FaqSection } from "@/components/content/faq-section";
import { ConsultationDialog } from "@/components/lead/consultation-dialog";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";

/**
 * Prerendered and revalidated on the same 10-minute cadence as the profile —
 * unlike `/reviews`, this route reads no `searchParams`, so there is nothing to
 * opt it out of static rendering.
 */
export const revalidate = 600;

/** How a `priceModel` reads in a sentence. Mirrors the profile's labels. */
const PRICE_MODEL_LABELS: Record<string, string> = {
  per_treatment: "Per treatment",
  per_session: "Per session",
  package: "Package",
  consult_to_quote: "Quoted after consultation",
};

/** Blank/whitespace-only editor fields mean "not set" — fall through. */
const override = (v: string | undefined | null): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const clinic = await getClinicProfile(params.slug);
  if (!clinic) return pageMetadata({ title: "Clinic not found" });

  const seo = clinic.raw.costPage?.seo;

  return pageMetadata({
    // Exact-match the query pattern: "<clinic> cost". One formula for every
    // clinic in the directory — see lib/clinic-meta.ts. The brand suffix comes
    // from the Settings title template, so this renders as
    // "<clinic> Cost | My Stem Cell Guide".
    title: clinicCostMetaTitle(clinic),
    description: clinicCostMetaDescription(clinic),
    boldDescriptionPrefix: clinicCostMetaBoldPrefix(clinic),
    keywords: clinicCostKeywords(clinic),
    path: `/clinic/${clinic.slug}/cost`,
    // `buildMetadata` reads `input.image` before `seo.ogImage`, so resolve the
    // override here or the clinic's cover would always win over it.
    image: override(seo?.ogImage) ?? clinic.coverUrl ?? clinic.logoUrl,
    // `costPage.seo`, not `clinic.raw.seo` — the latter belongs to the profile,
    // and reusing it would point this page's canonical at the profile.
    seo: seo ?? null,
  });
}

export default async function ClinicCostPage({
  params,
}: {
  params: { slug: string };
}) {
  const clinic = await getClinicProfile(params.slug);
  if (!clinic) {
    // A re-slugged clinic has a redirect on its *profile* path, so carry the
    // child segment across: /clinic/old/cost → /clinic/new/cost.
    const hit = await resolveRedirect(`/clinic/${params.slug}`);
    if (hit?.to.startsWith("/")) {
      applyRedirect(hit, `${hit.to.replace(/\/+$/, "")}/cost`);
    }
    return redirectOrNotFound(`/clinic/${params.slug}/cost`);
  }

  const cms = clinic.raw.costPage;
  const currency = clinic.currency ?? "USD";
  const items = cms?.items ?? [];
  // "Priced" means the row states a cost, so a $0 line (a free consultation,
  // something already inside the headline fee) does not count towards the
  // headline "published price lines" figure and does not become an `Offer`.
  const priced = items.filter(
    (i) => (i.priceMin != null && i.priceMin > 0) || (i.priceMax ?? 0) > 0,
  );
  const includes = cms?.includes ?? [];
  const excludes = cms?.excludes ?? [];
  const faqs = (cms?.faqs ?? []).map((f) => ({
    question: f.question,
    answer: f.answer,
  }));
  const sources = cms?.sources ?? [];
  const bodyMarkdown = override(cms?.bodyMarkdown);

  const hq =
    clinic.locations.find((l) => l.isHQ) ?? clinic.locations[0] ?? null;
  const hqLabel = hq ? [hq.city, hq.country].filter(Boolean).join(", ") : null;

  const dialogConditions = clinic.conditions.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  /**
   * One row's price, as a reader reads it. `null` when the row is quote-only.
   *
   * Zero is its own case rather than "From $0": a free consultation and a line
   * already covered by the headline fee are both real, useful rows, and
   * printing a currency-formatted zero for either reads as a pricing bug.
   */
  const rowPrice = (item: (typeof items)[number]): string | null => {
    const cur = item.currency || currency;
    const money = (n: number) => formatPrice(n, { currency: cur });
    if (item.priceMin === 0 && item.priceMax == null) {
      return item.unit === "included" ? "Included" : "Free";
    }
    if (item.priceMin != null && item.priceMax != null) {
      return item.priceMax > item.priceMin
        ? `${money(item.priceMin)} to ${money(item.priceMax)}`
        : money(item.priceMin);
    }
    if (item.priceMin != null) return `From ${money(item.priceMin)}`;
    if (item.priceMax != null) return `Up to ${money(item.priceMax)}`;
    return null;
  };

  const headlineRange =
    clinic.priceMin != null && clinic.priceMax != null
      ? `${formatPrice(clinic.priceMin, { currency })} to ${formatPrice(clinic.priceMax, { currency })}`
      : clinic.priceMin != null
        ? `From ${formatPrice(clinic.priceMin, { currency })}`
        : clinic.priceMax != null
          ? `Up to ${formatPrice(clinic.priceMax, { currency })}`
          : null;

  const verified = cms?.lastVerifiedAt
    ? new Date(cms.lastVerifiedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  // Same `clinic` content type as the profile and the reviews page, so any
  // per-record schema overrides an editor set still apply. This URL adds the
  // two nodes only it can support: the price table as a nested `OfferCatalog`,
  // and the cost questions as an `FAQPage`.
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "clinic",
    {
      clinic: clinicNodeInput(clinic),
      path: `/clinic/${clinic.slug}/cost`,
      priceItems: priced.map((i) => ({
        label: i.label,
        priceMin: i.priceMin,
        priceMax: i.priceMax,
        currency: i.currency,
        unit: i.unit,
      })),
      faqs,
    },
    ctx,
    clinic.raw.schemaOverrides ?? null,
  );

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
              { name: "Cost", href: `/clinic/${clinic.slug}/cost` },
            ]}
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[30px]">
                  {override(cms?.heading) ?? `${clinic.name} cost`}
                </h1>
                {clinic.badge ? <VerifiedBadge badge={clinic.badge} /> : null}
              </div>

              {/* The answer-first paragraph. An AI answer engine lifts this, so
                  it states the figure (or its absence) in the first clause. */}
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
                {override(
                  priced.length ? cms?.intro : (cms?.introEmpty ?? cms?.intro),
                ) ??
                  (headlineRange ? (
                    <>
                      Treatment at {clinic.name}
                      {hqLabel ? ` in ${hqLabel}` : ""} costs{" "}
                      {headlineRange.replace(/^From |^Up to /, (m) =>
                        m.toLowerCase(),
                      )}
                      . Prices are set by the clinic and confirmed at
                      consultation, and the figures below are what it publishes
                      or has told patients.
                    </>
                  ) : (
                    <>
                      {clinic.name}
                      {hqLabel ? ` in ${hqLabel}` : ""} does not publish a price
                      list. What follows is how a quote is put together, what it
                      covers, and where the money goes, so you can judge the
                      number when you get it.
                    </>
                  ))}
              </p>

              <Link
                href={`/clinic/${clinic.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-text-link hover:underline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to the full {clinic.name} profile
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ConsultationDialog
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                source={`cost:${clinic.slug}`}
                trigger={
                  <Button>
                    <MessageSquareText
                      className="size-[18px]"
                      aria-hidden="true"
                    />
                    Ask for a quote
                  </Button>
                }
              />
              {clinic.website ? (
                <Button variant="secondary" asChild>
                  <a
                    href={`/r/${clinic.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                  >
                    <ExternalLink className="size-[18px]" aria-hidden="true" />
                    Visit website
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0">
          {/* Cost at a glance — the numbers an answer engine can lift whole. */}
          <section aria-labelledby="cost-summary">
            <h2
              id="cost-summary"
              className="font-display text-xl font-semibold text-text-primary"
            >
              Cost at a glance
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={<Tag className="size-4" />}
                label="Typical cost"
                value={headlineRange ?? "Quoted per patient"}
              />
              <Stat
                icon={<Receipt className="size-4" />}
                label="How it is priced"
                value={
                  clinic.priceModel
                    ? (PRICE_MODEL_LABELS[clinic.priceModel] ??
                      clinic.priceModel)
                    : "Not stated"
                }
              />
              <Stat
                icon={<Wallet className="size-4" />}
                label="Published price lines"
                value={priced.length ? String(priced.length) : "None published"}
              />
              <Stat
                icon={<CalendarCheck className="size-4" />}
                label="Prices checked"
                value={verified ?? "Not stated"}
              />
            </dl>
            <DisclaimerNote variant="pricing" className="mt-3" />
          </section>

          {/* The price table — the page's reason to exist. */}
          <section id="prices" className="mt-10 scroll-mt-24">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              {priced.length
                ? `What ${clinic.name} charges`
                : `How ${clinic.name} prices treatment`}
            </h2>

            {items.length ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
                <table className="w-full caption-bottom text-sm">
                  <thead className="bg-surface-alt">
                    <tr className="border-b border-border">
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-[12px] font-semibold text-text-secondary"
                      >
                        Treatment or service
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold text-text-secondary"
                      >
                        Cost
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold text-text-secondary"
                      >
                        Billed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const price = rowPrice(item);
                      return (
                        <tr
                          key={`${item.label}-${i}`}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <span className="text-[14px] font-medium text-text-primary">
                              {item.label}
                            </span>
                            {item.note ? (
                              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-muted">
                                {item.note}
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top font-display text-[14px] font-semibold text-text-primary">
                            {price ?? (
                              <span className="font-sans font-normal text-text-muted">
                                On consultation
                              </span>
                            )}
                          </td>
                          {/* Plain hyphen, not an en dash. The site-wide copy
                              rule (`lib/meta-text.ts`) bans em and en dashes in
                              rendered text, and a placeholder is rendered text
                              like any other. This only ever showed once a row
                              arrived without a unit. */}
                          <td className="whitespace-nowrap px-4 py-3 align-top text-[13px] text-text-secondary">
                            {item.unit ?? "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-border bg-surface p-5 text-[14px] leading-relaxed text-text-secondary shadow-card">
                {clinic.priceNote ??
                  `${clinic.name} publishes no price list. Cost is quoted after a consultation, and it moves with the treatment, the number of sites treated, and how many sessions are planned. Ask for the quote in writing and check what it includes before you pay a deposit.`}
              </p>
            )}

            {items.length && clinic.priceNote ? (
              <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">
                {clinic.priceNote}
              </p>
            ) : null}
          </section>

          {/* What the quote covers. Two columns, because the second one is the
              half people find out about after they have paid. */}
          {includes.length || excludes.length ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                What the price includes
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {includes.length ? (
                  <ListCard title="Included" tone="included" items={includes} />
                ) : null}
                {excludes.length ? (
                  <ListCard
                    title="Billed separately"
                    tone="excluded"
                    items={excludes}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Insurance & financing — the second question after "how much". */}
          {cms?.insuranceNote || cms?.financingNote ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Insurance, financing and payment
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {cms?.insuranceNote ? (
                  <NoteCard
                    icon={<ShieldQuestion className="size-[18px]" />}
                    title="Insurance"
                    body={cms.insuranceNote}
                  />
                ) : null}
                {cms?.financingNote ? (
                  <NoteCard
                    icon={<CreditCard className="size-[18px]" />}
                    title="Financing"
                    body={cms.financingNote}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Editorial context. `renderMarkdown` escapes HTML before rendering
              its subset, so the stored string can't smuggle markup in (PRD §13). */}
          {bodyMarkdown ? (
            <section
              className="prose-article mt-10"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderMarkdown(bodyMarkdown) }}
            />
          ) : null}

          {faqs.length ? (
            <FaqSection
              className="mt-10"
              heading={`${clinic.name} cost questions`}
              items={faqs}
            />
          ) : null}

          {/* Value for money, straight from the reviews — the one number here
              that patients rather than the clinic put on it. */}
          {clinic.reviewCount > 0 && clinic.ratingBreakdown?.value ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                What patients say about the value
              </h2>
              <Link
                href={`/clinic/${clinic.slug}/reviews`}
                className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong"
              >
                <span>
                  <span className="block text-[12px] text-text-muted">
                    Value for money
                  </span>
                  <RatingStars
                    value={clinic.ratingBreakdown.value}
                    showValue
                    size={16}
                    className="mt-1"
                  />
                </span>
                <span className="text-[13.5px] font-semibold text-text-link">
                  Read all {clinic.name} reviews
                </span>
              </Link>
            </section>
          ) : null}

          {/* Provenance. A price page that doesn't say where its numbers came
              from is asking to be taken on faith. */}
          {sources.length || verified ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Where these figures come from
              </h2>
              {sources.length ? (
                <ul className="mt-3 space-y-1.5 text-[13.5px] text-text-secondary">
                  {sources.map((s, i) => (
                    <li key={`${s.label}-${i}`} className="flex gap-2">
                      <BadgeCheck
                        className="mt-0.5 size-4 shrink-0 text-text-muted"
                        aria-hidden="true"
                      />
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="font-medium text-text-link hover:underline"
                        >
                          {s.label}
                        </a>
                      ) : (
                        <span>{s.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {verified ? (
                <p className="mt-3 text-[13px] text-text-muted">
                  Last checked {verified}. Clinics change their prices without
                  notice, so treat every figure here as a starting point and
                  confirm it in writing.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="font-display text-base font-semibold text-text-primary">
              {override(cms?.ctaHeading) ?? `Get a price from ${clinic.name}`}
            </p>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              {override(cms?.ctaBody) ??
                "Send your case and ask for the quote in writing, itemised. No obligation."}
            </p>
            <div className="mt-4">
              <ConsultationDialog
                clinicId={clinic.id}
                clinicName={clinic.name}
                conditions={dialogConditions}
                source={`cost-rail:${clinic.slug}`}
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
              See treatments, team and accreditations
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
            <p className="font-display text-base font-semibold text-text-primary">
              Been treated at {clinic.name}?
            </p>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              Reviews that report what treatment actually cost are the ones
              patients read first.
            </p>
            <Button asChild variant="secondary" className="mt-4 w-full">
              <Link href={`/reviews/new?clinic=${clinic.slug}`}>
                <Star className="size-[18px]" aria-hidden="true" />
                Write a review
              </Link>
            </Button>
          </div>

          <DisclaimerNote variant="medical" className="mt-4" />
        </aside>
      </div>
    </>
  );
}

function Stat({
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

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "included" | "excluded";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="font-display text-[14px] font-semibold text-text-primary">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-text-secondary">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="flex items-start gap-2">
            {tone === "included" ? (
              <BadgeCheck
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
            ) : (
              <Minus
                className="mt-0.5 size-4 shrink-0 text-text-muted"
                aria-hidden="true"
              />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoteCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="flex items-center gap-2 font-display text-[14px] font-semibold text-text-primary">
        <span className="text-primary">{icon}</span>
        {title}
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
        {body}
      </p>
    </div>
  );
}

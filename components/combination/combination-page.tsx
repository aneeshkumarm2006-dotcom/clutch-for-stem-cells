import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import {
  getCountryBySlug,
  getDirectoryData,
  getTaxonomyTermBySlug,
} from "@/lib/public-data";
import {
  getApprovedComboLinks,
  getApprovedMatrixPage,
} from "@/lib/seoteam/matrix-data";
import { directoryParamsFrom } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { matrixPagePath } from "@/lib/matrix";
import {
  faqPageJsonLd,
  itemListJsonLd,
  medicalConditionJsonLd,
  medicalTherapyJsonLd,
  medicalWebPageJsonLd,
  type JsonLd as JsonLdData,
} from "@/lib/seo";
import type { MatrixKind } from "@/lib/enums";
import type { FilterDimension } from "@/components/directory/directory-controls";
import type { DirectoryBreadcrumb } from "@/components/directory/directory";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClinicResults } from "@/components/directory/clinic-results";
import { AnswerBlock } from "@/components/content/answer-block";
import { EditorialArticle } from "@/components/content/editorial-article";
import {
  RelatedLinks,
  type RelatedLinkGroup,
} from "@/components/directory/related-links";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { JsonLd } from "@/components/seo/json-ld";
import type { MatrixPageView } from "@/lib/seoteam/matrix-data";

interface CombinationContext {
  overrides: Record<string, unknown>;
  locked: FilterDimension[];
  breadcrumbs: DirectoryBreadcrumb[];
  about: JsonLdData;
  /** Neutral relation groups linking to sibling combos + parent hubs. */
  relatedGroups: RelatedLinkGroup[];
}

/**
 * The filter dimensions pinned by each combo route's path. Single source of
 * truth shared by {@link resolveContext} (which locks these facets in the UI)
 * and {@link buildCombinationMetadata} (which must ignore the same locked
 * dimensions when deciding if a URL is a thin faceted variant). Keep in sync
 * with the `locked` arrays below.
 */
function lockedDimensionsForKind(kind: MatrixKind): FilterDimension[] {
  switch (kind) {
    case "treatment_condition":
      return ["treatment", "condition"];
    case "treatment_country":
      return ["treatment", "country"];
    case "condition_country":
      return ["condition", "country"];
    default:
      return [];
  }
}

/**
 * Resolve the per-kind bits: which facets to lock, breadcrumb trail, the primary
 * schema entity, and sibling/parent internal links. Returns null when a parent
 * term is missing (→ 404).
 */
async function resolveContext(
  view: MatrixPageView,
): Promise<CombinationContext | null> {
  const { kind, slugA, slugB } = view;

  if (kind === "treatment_condition") {
    const [treatment, condition] = await Promise.all([
      getTaxonomyTermBySlug("treatment", slugA),
      getTaxonomyTermBySlug("condition", slugB),
    ]);
    if (!treatment || !condition) return null;
    const siblings = await getApprovedComboLinks({
      kind,
      slugA,
    });
    return {
      overrides: { treatments: [slugA], conditions: [slugB] },
      locked: lockedDimensionsForKind(kind),
      breadcrumbs: [
        { name: "Home", href: "/" },
        { name: "Treatments", href: "/treatments" },
        { name: treatment.name, href: `/treatments/${slugA}` },
        { name: `for ${condition.name}`, href: view.path },
      ],
      about: medicalTherapyJsonLd({
        name: treatment.name,
        path: `/treatments/${slugA}`,
        indication: [condition.name],
      }),
      relatedGroups: [
        {
          title: `${treatment.name} for other conditions`,
          links: siblings
            .filter((s) => s.slugB !== slugB)
            .map((s) => ({ href: s.path, label: s.title })),
        },
        {
          title: "Explore the single topics",
          links: [
            {
              href: `/treatments/${slugA}`,
              label: `All ${treatment.name} clinics`,
            },
            {
              href: `/conditions/${slugB}`,
              label: `All clinics treating ${condition.name}`,
            },
          ],
        },
      ],
    };
  }

  // treatment_country | condition_country — country is slugB (the hub).
  const isTreatment = kind === "treatment_country";
  const [primary, country] = await Promise.all([
    getTaxonomyTermBySlug(isTreatment ? "treatment" : "condition", slugA),
    getCountryBySlug(slugB),
  ]);
  if (!primary || !country) return null;

  const overrides = isTreatment
    ? { treatments: [slugA], country: country.name }
    : { conditions: [slugA], country: country.name };
  const locked = lockedDimensionsForKind(kind);
  const primaryBase = isTreatment
    ? `/treatments/${slugA}`
    : `/conditions/${slugA}`;

  const siblings = await getApprovedComboLinks({ kind, slugB });

  return {
    overrides,
    locked,
    breadcrumbs: [
      { name: "Home", href: "/" },
      { name: "Destinations", href: "/locations" },
      { name: country.name, href: `/locations/${slugB}` },
      { name: primary.name, href: view.path },
    ],
    about: isTreatment
      ? medicalTherapyJsonLd({ name: primary.name, path: primaryBase })
      : medicalConditionJsonLd({ name: primary.name, path: primaryBase }),
    relatedGroups: [
      {
        title: `More in ${country.name}`,
        links: siblings
          .filter((s) => s.slugA !== slugA)
          .map((s) => ({ href: s.path, label: s.title })),
      },
      {
        title: "Explore the single topics",
        links: [
          { href: primaryBase, label: `All ${primary.name} clinics` },
          {
            href: `/locations/${slugB}`,
            label: `All clinics in ${country.name}`,
          },
        ],
      },
    ],
  };
}

/**
 * Shared renderer for all three combination-page kinds. Fetches the approved
 * MatrixPage (404s otherwise), composes editorial content ABOVE the clinic list
 * (so a 0-clinic page still stands on its informational value), and emits the
 * full MedicalWebPage/therapy-condition/FAQ/ItemList schema graph.
 */
export async function CombinationPage({
  kind,
  slugA,
  slugB,
  searchParams,
}: {
  kind: MatrixKind;
  slugA: string;
  slugB: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const view = await getApprovedMatrixPage(kind, slugA, slugB);
  if (!view) notFound();

  const ctx = await resolveContext(view);
  if (!ctx) notFound();

  const data = await getDirectoryData(
    directoryParamsFrom(searchParams, ctx.overrides),
  );

  const jsonLd = [
    medicalWebPageJsonLd({
      name: view.title,
      description: view.metaDescription ?? view.intro,
      path: view.path,
      lastReviewed: view.editorial.lastReviewedAt,
      dateModified: view.editorial.updatedAt,
      reviewedBy: view.editorial.reviewer,
      about: ctx.about,
    }),
    ...(view.editorial.faqs.length ? [faqPageJsonLd(view.editorial.faqs)] : []),
    ...(data.cards.length
      ? [
          itemListJsonLd(
            data.cards.map((c) => ({
              path: `/clinic/${c.slug}`,
              name: c.name,
            })),
          ),
        ]
      : []),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="container py-8 md:py-10">
        <Breadcrumbs items={ctx.breadcrumbs} className="mb-4" />

        <header className="max-w-3xl">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
            {view.title}
          </h1>
        </header>

        {view.intro ? (
          <div className="mt-5 max-w-3xl">
            <AnswerBlock>{view.intro}</AnswerBlock>
          </div>
        ) : null}

        <div className="mt-8 max-w-3xl">
          <EditorialArticle data={view.editorial} />
        </div>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            Clinics in our directory
          </h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Every result is ranked by our published{" "}
            <a href="/methodology" className="text-text-link hover:underline">
              methodology
            </a>
            .
          </p>
          <div className="mt-5">
            <ClinicResults
              basePath={view.path}
              searchParams={searchParams}
              data={data}
              locked={ctx.locked}
              filterLabels={data.filterLabels}
              emptyTitle="No clinics list this exact combination yet"
              emptyDescription="No directory clinic currently matches all of these filters. Broaden your search, or let us match you with clinics that fit."
            />
          </div>
        </section>

        <div className="mt-12 border-t border-border pt-8">
          <RelatedLinks groups={ctx.relatedGroups} />
          <DisclaimerNote variant="medical" className="mt-8" />
        </div>
      </div>
    </>
  );
}

/**
 * Shared `generateMetadata` for the three combination routes. Canonical is the
 * combo's own path; a non-indexable (approved-but-thin) or missing record gets
 * `noindex`, and — because the page renders a filterable clinic list — any
 * faceted/sorted/paged variant (`?minRating=…`, `?priceMax=…`, `?page=2`, …)
 * also gets `noindex, follow`, canonicalized back to the clean combo path. The
 * route-locked dimensions (treatment/condition/country pinned in the path) are
 * ignored so the clean combo URL itself stays indexable. Mirrors the
 * faceted-directory rule applied on `/clinics` and `/treatments/[slug]`.
 */
export async function buildCombinationMetadata(
  kind: MatrixKind,
  slugA: string,
  slugB: string,
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<Metadata> {
  const view = await getApprovedMatrixPage(kind, slugA, slugB);
  if (!view) {
    return pageMetadata({
      title: "Page not found",
      path: matrixPagePath(kind, slugA, slugB),
      noindex: true,
    });
  }
  const noindex =
    !view.indexable ||
    shouldNoindexDirectory(searchParams, {
      locked: lockedDimensionsForKind(kind),
    });
  return pageMetadata({
    title: view.metaTitle ?? view.title,
    description: view.metaDescription ?? view.intro?.slice(0, 160),
    path: view.path,
    seo: view.seo ?? null,
    noindex,
  });
}

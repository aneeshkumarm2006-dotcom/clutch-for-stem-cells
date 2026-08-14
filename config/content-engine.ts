/**
 * ════════════════════════════════════════════════════════════════════════════
 *  THE CONTENT ENGINE CONFIG — the one file you rewrite to port this system.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Both upgrades — the structured-data (JSON-LD) engine and the modular
 * content/SEO layer — read everything site-specific from here:
 *
 *   1. `siteIdentity` — name, logo, socials, default OG image, publisher type.
 *      These are the BUILD-TIME fallback; the admin `SiteSetting` singleton
 *      overlays them at runtime (see `lib/schema/context.ts`), so an editor can
 *      change the org name or logo without a deploy.
 *   2. `contentTypes` — the content-type → schema.org-node map. Each entry says
 *      which `@type`s a page of that kind may emit and how to build them from
 *      the record (the builders live in `lib/schema/adapters.ts`).
 *   3. `blocks` — which content blocks editors may compose pages from.
 *   4. `seoDefaults` — global SEO fallbacks.
 *
 * The engine core (`lib/schema/engine.ts`, `validate.ts`) contains NO domain
 * concept. To drop this into another dashboard: run discovery, then rewrite this
 * file and `lib/schema/adapters.ts` to match the new repo's models. Nothing else
 * changes.
 */
import { BLOCK_TYPES, type BlockType } from "@/lib/enums";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
} from "@/config/site";
import { defineContentType, type ContentTypeSchemaConfig } from "@/lib/schema/types";
import {
  buildBlogPostNodes,
  buildClinicNodes,
  buildDirectoryNodes,
  buildFaqPageNodes,
  buildPageNodes,
  buildReviewerNodes,
  buildTopicalNodes,
} from "@/lib/schema/adapters";

export const CONTENT_ENGINE = {
  /**
   * Site identity — build-time fallback, overlaid at runtime by `SiteSetting`
   * (`social`, `seoDefaults.ogImage`, and the structured-data settings).
   */
  siteIdentity: {
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    /** Root-relative or absolute logo URL. Editable in admin Settings. */
    logo: undefined as string | undefined,
    /** Default social/OG share image. Editable in admin Settings. */
    defaultOgImage: undefined as string | undefined,
    /**
     * schema.org type for the publisher. A medical directory may prefer
     * `MedicalOrganization`; a marketplace, `Organization`.
     */
    organizationType: "Organization",
    /** Authoritative profile URLs → `Organization.sameAs`. */
    sameAs: Object.values(SOCIAL_LINKS).filter(Boolean) as string[],
    /** The sitelinks search box deep-links here. */
    searchPath: "/search",
    /** `contactPoint.url` on the `Organization` node. */
    contactPath: "/contact",
    /**
     * Subject-matter the publisher covers → `Organization.knowsAbout`. These are
     * topics, not keywords: the point is to let an engine resolve what this
     * entity is authoritative *about*, which is why they read as the site's
     * actual coverage rather than as a target-term list.
     */
    knowsAbout: [
      "Stem cell therapy",
      "Regenerative medicine",
      "Mesenchymal stem cell therapy",
      "Medical tourism",
      "Clinic accreditation",
    ] as string[],
    /**
     * The publisher-integrity pages, in machine-readable form.
     *
     * On a YMYL health directory this is the cheapest E-E-A-T available: the
     * pages already exist and are already linked in the footer, and pointing the
     * `Organization` node at them is what states — to a crawler rather than only
     * to a reader — that the site has an editorial process, a corrections route,
     * and disclosed ownership. Blank out any entry whose page a deployment does
     * not have; an absent key simply drops from the node.
     */
    policies: {
      publishingPrinciples: "/editorial-policy",
      correctionsPolicy: "/editorial-policy",
      ethicsPolicy: "/editorial-policy",
      actionableFeedbackPolicy: "/contact",
      ownershipFundingInfo: "/about",
    },
  },

  /**
   * ── The content-type → schema.org map ─────────────────────────────────────
   *
   * `nodes` declares every `@type` the content type may emit. It drives the
   * per-node on/off toggles in the admin schema panel, so it must list what
   * `build` actually produces (including types nested inside another node, e.g.
   * `AggregateRating` inside `MedicalClinic` — the engine knows how to strip a
   * nested node when it is toggled off).
   */
  contentTypes: {
    /** entity / listing — the central directory record. */
    clinic: defineContentType({
      label: "Clinic profile",
      // Also covers the clinic's child URLs: `/reviews` adds more `Review`
      // nodes, `/cost` adds the nested `OfferCatalog` and an `FAQPage`.
      nodes: [
        "MedicalClinic",
        "AggregateRating",
        "OfferCatalog",
        "Review",
        "FAQPage",
      ],
      build: buildClinicNodes,
    }),

    /** article / post. */
    blogPost: defineContentType({
      label: "Blog post",
      nodes: ["BlogPosting"],
      build: buildBlogPostNodes,
    }),

    /** Topical YMYL term page (treatment / condition / location). */
    taxonomyTerm: defineContentType({
      label: "Taxonomy term page",
      nodes: ["MedicalWebPage", "FAQPage", "ItemList"],
      build: buildTopicalNodes,
    }),

    /** Programmatic combination page (treatment × condition, …). */
    matrixPage: defineContentType({
      label: "Combination page",
      nodes: ["MedicalWebPage", "FAQPage", "ItemList"],
      build: buildTopicalNodes,
    }),

    /** collection / index — any directory or listing page. */
    directory: defineContentType({
      label: "Directory / index",
      nodes: ["CollectionPage", "ItemList"],
      build: buildDirectoryNodes,
    }),

    /** Editor-composed block page. Blocks contribute their own nodes. */
    page: defineContentType({
      label: "Composed page",
      nodes: ["WebPage", "FAQPage", "ItemList"],
      build: buildPageNodes,
    }),

    /**
     * Medical-reviewer bio (the E-E-A-T author entity). `ProfilePage` is the
     * wrapper Google documents for author/"about me" pages and still actively
     * supports; the `Person` is nested inside it as `mainEntity`.
     */
    reviewer: defineContentType({
      label: "Reviewer bio",
      nodes: ["ProfilePage", "Person"],
      build: buildReviewerNodes,
    }),

    /** A static page whose primary content is an FAQ. */
    faqPage: defineContentType({
      label: "FAQ page",
      nodes: ["WebPage", "FAQPage"],
      build: buildFaqPageNodes,
    }),
  },

  /** Block types editors may compose Pages from. Trim to disable one. */
  blocks: BLOCK_TYPES as readonly BlockType[],

  /** Global SEO fallbacks (admin Settings override these at runtime). */
  seoDefaults: {
    titleTemplate: `%s | ${SITE_NAME}`,
    twitterCard: "summary_large_image" as const,
    robots: { index: true, follow: true },
  },
} as const;

// ── Derived types ───────────────────────────────────────────────────────────

export type ContentTypeKey = keyof typeof CONTENT_ENGINE.contentTypes;

/** The data shape a given content type's builder expects (inferred, type-safe). */
export type ContentTypeData<K extends ContentTypeKey> =
  (typeof CONTENT_ENGINE.contentTypes)[K] extends ContentTypeSchemaConfig<
    infer D
  >
    ? D
    : never;

/** Every content-type key — powers the admin panel's type selector. */
export const CONTENT_TYPE_KEYS = Object.keys(
  CONTENT_ENGINE.contentTypes,
) as ContentTypeKey[];

/** The `@type`s a content type can emit (drives the admin toggles). */
export function nodesFor(type: ContentTypeKey): readonly string[] {
  return CONTENT_ENGINE.contentTypes[type].nodes;
}

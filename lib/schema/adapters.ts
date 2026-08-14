/**
 * Domain adapters — the My Stem Cell Guide-specific half of the schema engine.
 *
 * Each function maps one of this app's content shapes onto the JSON-LD
 * generators that already live in `lib/seo.ts`. **This file and
 * `config/content-engine.ts` are the only two places a domain concept
 * ("clinic", "treatment", "combination page") may appear.** The engine core
 * (`lib/schema/engine.ts`) never names one, so porting to another dashboard
 * means rewriting these two files and nothing else.
 *
 * Note on `BreadcrumbList`: it is deliberately NOT built here. The shared
 * `<Breadcrumbs>` component (`components/common/breadcrumbs.tsx`) already emits
 * it alongside the visible trail, which keeps the UI and the markup impossible
 * to desync. Emitting it here too would put two `BreadcrumbList` nodes on every
 * page.
 */
import {
  blogPostingJsonLd,
  faqPageJsonLd,
  itemListJsonLd,
  medicalClinicJsonLd,
  medicalWebPageJsonLd,
  offerCatalogJsonLd,
  profilePageJsonLd,
  reviewJsonLd,
  webPageJsonLd,
  type BlogPostingSeoInput,
  type ItemListEntry,
  type ItemListOptions,
  type MedicalWebPageSeoInput,
  type OfferItemInput,
  type PersonSeoInput,
  type WebPageSeoInput,
} from "@/lib/seo";
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import type { BlockInput } from "@/lib/validation/block";
import type { ClinicProfile } from "@/lib/public-data";
import type { NodeList } from "@/lib/schema/types";

/**
 * The generator input types are structural `Pick`s of the models. Deriving them
 * with `Parameters<>` rather than re-declaring them means a field added to a
 * generator can never drift out of sync with its adapter.
 */
type ClinicNodeInput = Parameters<typeof medicalClinicJsonLd>[0];
type ReviewNodeInput = Parameters<typeof reviewJsonLd>[0];
type FaqEntry = { question: string; answer: string };

// ── entity / listing → MedicalClinic (+ nested AggregateRating) + Review ─────

export interface ClinicSchemaData {
  clinic: ClinicNodeInput;
  /** Approved reviews to nest as standalone `Review` nodes (cap at ~5). */
  reviews?: ReviewNodeInput[];
  /**
   * Published price lines → an `OfferCatalog` nested on the clinic. Passed only
   * by the cost page: the profile carries a `priceRange`, and repeating the
   * whole catalogue on a URL that doesn't show it would describe a page that
   * isn't there.
   */
  priceItems?: OfferItemInput[];
  /** Page-scoped Q&A → `FAQPage`. The cost page's cost questions. */
  faqs?: FaqEntry[];
  /**
   * Root-relative path of the URL being rendered. A clinic has three (`/clinic/x`,
   * `/clinic/x/reviews`, `/clinic/x/cost`) and only the caller knows which one
   * this is — it scopes the `FAQPage` `@id` to the URL that actually shows the
   * questions.
   */
  path?: string;
}

/**
 * Fold a clinic's *resolved* taxonomy back onto the raw document for the schema
 * builders.
 *
 * `clinic.raw` alone describes where a clinic is; it cannot say what it treats,
 * because its treatments, conditions and accreditations are ObjectIds until the
 * read layer populates them. This is the one place that joins the two, so all
 * three clinic URLs (profile, reviews, cost) emit the same `MedicalClinic` node
 * instead of three subtly different ones.
 */
export function clinicNodeInput(clinic: ClinicProfile): ClinicNodeInput {
  const staff = [clinic.medicalDirector, ...clinic.team]
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.name))
    .map((p) => ({ name: p.name, role: p.title }));

  return {
    ...clinic.raw,
    services: clinic.treatments.map((t) => t.name).filter(Boolean),
    conditions: clinic.conditions.map((c) => c.name).filter(Boolean),
    accreditationsHeld: clinic.accreditations.map((a) => ({
      name: a.name,
      issuingBody: a.issuingBody,
    })),
    // Named clinicians only. A head count would be a different claim, and
    // `physiciansCount` is not the same thing as `numberOfEmployees`.
    staff: staff.length ? staff : undefined,
  };
}

/**
 * `MedicalClinic` — the entity/listing role. `AggregateRating`, `OfferCatalog`
 * and `Review` are embedded on that node rather than emitted standalone, so they
 * are not separate entries here (all three are still listed in the config's
 * `nodes` so the admin panel can toggle them — see `NESTED_NODES` in the
 * engine).
 *
 * Reviews nest for a correctness reason, not a stylistic one. A top-level
 * `Review` has to name what it reviews, and the only thing available is a stub
 * `{"@type":"MedicalClinic","name":…}` — a second, address-less clinic node that
 * validators reject for missing the fields a `LocalBusiness` requires. Nesting
 * them under `review` makes the fully-described clinic on the same page the
 * reviewed item, which is also the shape Google documents for a business
 * carrying both `aggregateRating` and individual reviews.
 */
export function buildClinicNodes(data: ClinicSchemaData): NodeList {
  const catalog = data.priceItems?.length
    ? offerCatalogJsonLd(data.priceItems, data.clinic.currency)
    : undefined;

  // Nested nodes sit outside `dropInvalidNodes`, which only walks the top level,
  // so the required-field check a standalone `Review` used to get happens here:
  // a review with no rating on file would nest as a `Review` without
  // `reviewRating`, which is exactly the invalid node that guard exists to stop.
  const reviews = (data.reviews ?? [])
    .map((r) => reviewJsonLd(r, false))
    .filter((r) => r.author && r.reviewRating);

  return [
    {
      ...medicalClinicJsonLd(data.clinic),
      ...(catalog ? { hasOfferCatalog: catalog } : {}),
      ...(reviews.length ? { review: reviews } : {}),
    },
    data.faqs?.length ? faqPageJsonLd(data.faqs, data.path) : null,
  ];
}

// ── article / post → BlogPosting ────────────────────────────────────────────

export interface BlogPostSchemaData {
  post: BlogPostingSeoInput;
}

export function buildBlogPostNodes(data: BlogPostSchemaData): NodeList {
  return [blogPostingJsonLd(data.post)];
}

// ── topical pages (taxonomy terms + combination pages) → MedicalWebPage ─────

export interface TopicalSchemaData {
  /** The YMYL page wrapper, carrying `reviewedBy` / `lastReviewed` provenance. */
  webPage: MedicalWebPageSeoInput;
  /** Scoped Q&A → `FAQPage`. */
  faqs?: FaqEntry[];
  /** Clinics listed on the page → `ItemList`. */
  items?: ItemListEntry[];
  /** Name for that `ItemList`, e.g. "Stem cell clinics for knee osteoarthritis". */
  itemsName?: string;
}

/**
 * Shared by taxonomy term pages and combination (matrix) pages — both are a
 * `MedicalWebPage` wrapping a condition/therapy entity, optionally with an FAQ
 * block and a list of matching clinics.
 *
 * The list is typed as `MedicalClinic` and each entry's `@id` points at the
 * `…#clinic` node the clinic's own profile publishes, so "clinics for knee
 * osteoarthritis" resolves to the same eleven entities the profile pages
 * describe rather than to eleven anonymous list positions.
 */
export function buildTopicalNodes(data: TopicalSchemaData): NodeList {
  const listOpts: ItemListOptions = {
    name: data.itemsName,
    path: data.webPage.path,
    itemType: "MedicalClinic",
    itemIdFragment: "clinic",
  };
  return [
    medicalWebPageJsonLd(data.webPage),
    data.faqs?.length ? faqPageJsonLd(data.faqs, data.webPage.path) : null,
    data.items?.length ? itemListJsonLd(data.items, listOpts) : null,
  ];
}

// ── collection / index → CollectionPage + ItemList ──────────────────────────

export interface DirectorySchemaData {
  name: string;
  description?: string;
  path: string;
  items?: ItemListEntry[];
  /**
   * `@type` of the listed things, e.g. `MedicalClinic` on `/clinics`. Omit for a
   * list of pages (a treatment index lists topics, not entities), which falls
   * back to plain `ListItem` + `url` entries.
   */
  itemType?: string;
  /** `@id` fragment those items carry on their own page, e.g. `clinic`. */
  itemIdFragment?: string;
  itemsName?: string;
}

export function buildDirectoryNodes(data: DirectorySchemaData): NodeList {
  return [
    webPageJsonLd({
      name: data.name,
      description: data.description,
      path: data.path,
      type: "CollectionPage",
    }),
    data.items?.length
      ? itemListJsonLd(data.items, {
          name: data.itemsName,
          path: data.path,
          itemType: data.itemType,
          itemIdFragment: data.itemIdFragment,
        })
      : null,
  ];
}

// ── composed (block) pages → WebPage + whatever the blocks contribute ───────

export interface PageSchemaData {
  page: WebPageSeoInput;
  /** Schema-aware blocks contribute their own nodes (FAQ → FAQPage, etc.). */
  blocks?: BlockInput[];
}

/**
 * An editor-composed page. The `WebPage` wrapper plus every node the page's
 * blocks contribute — this is what makes structured data a by-product of
 * composing the page rather than a separate chore.
 */
export function buildPageNodes(data: PageSchemaData): NodeList {
  return [webPageJsonLd(data.page), ...blocksToSchemaOrg(data.blocks ?? [])];
}

// ── reviewer bio → ProfilePage wrapping a Person (E-E-A-T author entity) ────

export interface ReviewerSchemaData {
  person: PersonSeoInput;
  dateCreated?: Date | string | null;
  dateModified?: Date | string | null;
}

/**
 * One `ProfilePage`, not a `ProfilePage` **and** a top-level `Person`: the
 * `Person` is the page's `mainEntity`, and emitting it twice would put two nodes
 * with the same `@id` on one URL. Every `reviewedBy` elsewhere on the site
 * points at that same `@id`, so the reviewer stays a single entity.
 */
export function buildReviewerNodes(data: ReviewerSchemaData): NodeList {
  return [
    profilePageJsonLd({
      person: data.person,
      dateCreated: data.dateCreated,
      dateModified: data.dateModified,
    }),
  ];
}

// ── standalone FAQ page → FAQPage ───────────────────────────────────────────

export interface FaqPageSchemaData {
  name: string;
  description?: string;
  path: string;
  faqs: FaqEntry[];
}

export function buildFaqPageNodes(data: FaqPageSchemaData): NodeList {
  return [
    webPageJsonLd({
      name: data.name,
      description: data.description,
      path: data.path,
    }),
    data.faqs.length ? faqPageJsonLd(data.faqs, data.path) : null,
  ];
}

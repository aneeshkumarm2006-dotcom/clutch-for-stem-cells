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
  personJsonLd,
  reviewJsonLd,
  webPageJsonLd,
  type BlogPostingSeoInput,
  type ItemListEntry,
  type MedicalWebPageSeoInput,
  type PersonSeoInput,
  type WebPageSeoInput,
} from "@/lib/seo";
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import type { BlockInput } from "@/lib/validation/block";
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
}

/**
 * `MedicalClinic` — the entity/listing role. `AggregateRating` is embedded by
 * `medicalClinicJsonLd` when the clinic has reviews, so it is not a separate
 * node here (it is still listed in the config's `nodes` so the admin panel can
 * toggle it — see `stripNestedNode` in the engine).
 */
export function buildClinicNodes(data: ClinicSchemaData): NodeList {
  return [
    medicalClinicJsonLd(data.clinic),
    ...(data.reviews ?? []).map((r) => reviewJsonLd(r)),
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
}

/**
 * Shared by taxonomy term pages and combination (matrix) pages — both are a
 * `MedicalWebPage` wrapping a condition/therapy entity, optionally with an FAQ
 * block and a list of matching clinics.
 */
export function buildTopicalNodes(data: TopicalSchemaData): NodeList {
  return [
    medicalWebPageJsonLd(data.webPage),
    data.faqs?.length ? faqPageJsonLd(data.faqs) : null,
    data.items?.length ? itemListJsonLd(data.items) : null,
  ];
}

// ── collection / index → CollectionPage + ItemList ──────────────────────────

export interface DirectorySchemaData {
  name: string;
  description?: string;
  path: string;
  items?: ItemListEntry[];
}

export function buildDirectoryNodes(data: DirectorySchemaData): NodeList {
  return [
    webPageJsonLd({
      name: data.name,
      description: data.description,
      path: data.path,
      type: "CollectionPage",
    }),
    data.items?.length ? itemListJsonLd(data.items) : null,
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

// ── reviewer bio → Person (E-E-A-T author entity) ───────────────────────────

export interface ReviewerSchemaData {
  person: PersonSeoInput;
}

export function buildReviewerNodes(data: ReviewerSchemaData): NodeList {
  return [personJsonLd(data.person)];
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
    data.faqs.length ? faqPageJsonLd(data.faqs) : null,
  ];
}

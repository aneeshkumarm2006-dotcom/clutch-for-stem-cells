/**
 * Structured-data engine — core types.
 *
 * Deliberately domain-free: nothing here knows what a "clinic" or a "treatment"
 * is. The map from a content type to the schema.org nodes it emits lives in
 * `config/content-engine.ts`, and the functions that read this app's model
 * shapes live in `lib/schema/adapters.ts`. Porting the engine to another
 * dashboard means rewriting those two files — never this one.
 */
import type { JsonLd, OrganizationPolicyPaths } from "@/lib/seo";

export type { JsonLd, OrganizationPolicyPaths };

/**
 * A builder may return `null`/`undefined` for a node that doesn't apply to the
 * record (e.g. no reviews → no `AggregateRating`). The engine drops them, so a
 * page never emits an empty or half-built node.
 */
export type NodeList = (JsonLd | null | undefined)[];

/**
 * Runtime site identity, resolved once per request from `SiteSetting` with the
 * `config/content-engine` values as fallback (see `lib/schema/context.ts`).
 * Builders read the site's name/logo/socials from here rather than reaching for
 * a constant, which is what makes the same builder reusable across dashboards.
 */
export interface SchemaContext {
  siteName: string;
  siteUrl: string;
  /** Absolute or root-relative logo URL. */
  logo?: string;
  /** Authoritative profile URLs → `Organization.sameAs`. */
  sameAs: string[];
  defaultOgImage?: string;
  /** schema.org type for the publisher, e.g. `Organization`. */
  organizationType: string;
  /** Path the `WebSite` `SearchAction` deep-links into, e.g. `/search`. */
  searchPath?: string;
  /** One-paragraph publisher description → `Organization.description`. */
  description?: string;
  /** Public contact details → `Organization.email`/`telephone`/`address`. */
  email?: string;
  telephone?: string;
  address?: string;
  /** Path of the contact page → `contactPoint.url`. */
  contactPath?: string;
  /** Subject-matter the publisher covers → `Organization.knowsAbout`. */
  knowsAbout?: string[];
  /**
   * Paths to the publisher's public policy pages → `publishingPrinciples`,
   * `correctionsPolicy`, `ethicsPolicy`, `actionableFeedbackPolicy`,
   * `ownershipFundingInfo`. The machine-readable half of E-E-A-T.
   */
  policies?: OrganizationPolicyPaths;
}

/**
 * One entry in the content-type → schema map.
 *
 * `nodes` declares the `@type`s this content type *can* emit. It drives the
 * admin panel's per-node toggles, so it must stay in sync with what `build`
 * actually returns; `build` produces the nodes from the record's data.
 */
export interface ContentTypeSchemaConfig<D> {
  /** Human label shown in the admin schema panel. */
  label: string;
  nodes: readonly string[];
  build: (data: D, ctx: SchemaContext) => NodeList;
}

/**
 * Identity helper that pins a content type's data shape so `buildJsonLd` stays
 * type-safe at every call site (the generic is inferred from the builder).
 */
export function defineContentType<D>(
  config: ContentTypeSchemaConfig<D>,
): ContentTypeSchemaConfig<D> {
  return config;
}

/** A single validation finding against a built node. */
export interface SchemaIssue {
  /** The node's `@type` the issue belongs to. */
  node: string;
  /** `error` blocks a save; `warning` is advisory (shown in the admin panel). */
  level: "error" | "warning";
  message: string;
}

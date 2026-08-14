/**
 * JSON-LD validation — the guard that keeps malformed or half-built structured
 * data off the site.
 *
 * Two levels, deliberately:
 *  - **error** — the node is invalid and Google would reject it (a `Review` with
 *    no author, an `AggregateRating` with no count). The admin panel blocks
 *    saving on these, and {@link dropInvalidNodes} strips them at render time so
 *    a bad node can never reach a crawler even if it slipped into the DB.
 *  - **warning** — the node is valid but weaker than it could be (a `BlogPosting`
 *    with no image). Surfaced in the admin panel; never blocks anything.
 *
 * Rules are keyed by `@type` and are generic schema.org requirements — no
 * My Stem Cell Guide concept appears here, so this file ports unchanged.
 */
import type { JsonLd, SchemaIssue } from "@/lib/schema/types";

/** Required + recommended keys per `@type`. Extend as new node types ship. */
const RULES: Record<
  string,
  { required?: string[]; recommended?: string[] }
> = {
  Organization: {
    required: ["name", "url"],
    recommended: ["logo", "description", "sameAs"],
  },
  MedicalOrganization: {
    required: ["name", "url"],
    recommended: ["logo", "description"],
  },
  WebSite: { required: ["name", "url"] },
  WebPage: { required: ["name", "url"] },
  CollectionPage: { required: ["name", "url"] },
  AboutPage: { required: ["name", "url"] },
  ContactPage: { required: ["name", "url"] },
  // Google documents `mainEntity` as the one required property of a ProfilePage,
  // and the entity itself needs a name to be worth anything.
  ProfilePage: { required: ["mainEntity"], recommended: ["dateModified"] },
  // No `reviewedBy`/`lastReviewed` recommendation: reviewer attribution is
  // deliberately optional on this site (a page ships unreviewed rather than
  // fabricating a reviewer), so warning on every unreviewed page would nag about
  // a decision that was made on purpose.
  MedicalWebPage: { required: ["name", "url"] },
  // Google requires `name` + `address` on a LocalBusiness. `address` stays a
  // warning rather than an error on purpose: a clinic whose address we have not
  // confirmed should still emit its name, url, rating and services, and dropping
  // the whole node over one missing field would lose all of that.
  MedicalClinic: {
    required: ["name"],
    recommended: ["address", "image", "url"],
  },
  Product: { required: ["name"] },
  Service: { required: ["name"] },
  SoftwareApplication: { required: ["name"] },
  Offer: { required: ["price", "priceCurrency"] },
  AggregateRating: { required: ["ratingValue", "reviewCount"] },
  Review: { required: ["author", "reviewRating"] },
  BlogPosting: { required: ["headline"], recommended: ["image", "datePublished"] },
  Article: { required: ["headline"], recommended: ["image", "datePublished"] },
  FAQPage: { required: ["mainEntity"] },
  ItemList: { required: ["itemListElement"] },
  BreadcrumbList: { required: ["itemListElement"] },
  Person: { required: ["name"] },
  MedicalCondition: { required: ["name"] },
  MedicalTherapy: { required: ["name"] },
  OfferCatalog: { required: ["itemListElement"] },
};

/** `true` when a key is genuinely absent (null, "", [], {}). */
function isMissing(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function typeOf(node: JsonLd): string {
  const t = node["@type"];
  return typeof t === "string" ? t : "Unknown";
}

/** Validate one node against its `@type` rules. */
export function validateNode(node: JsonLd): SchemaIssue[] {
  const type = typeOf(node);
  const rule = RULES[type];
  if (!rule) return [];

  const issues: SchemaIssue[] = [];

  for (const key of rule.required ?? []) {
    if (isMissing(node[key])) {
      issues.push({
        node: type,
        level: "error",
        message: `${type} is missing the required field "${key}".`,
      });
    }
  }
  for (const key of rule.recommended ?? []) {
    if (isMissing(node[key])) {
      issues.push({
        node: type,
        level: "warning",
        message: `${type} is missing the recommended field "${key}", so it may not qualify for a rich result.`,
      });
    }
  }

  return issues;
}

/** Validate a whole graph. */
export function validateNodes(nodes: JsonLd[]): SchemaIssue[] {
  return nodes.flatMap(validateNode);
}

/** `true` when any issue would make Google reject a node. */
export function hasErrors(issues: SchemaIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/**
 * Strip nodes that fail their required-field rules.
 *
 * This is the render-time backstop behind the admin panel's save-time block:
 * even if an invalid node reaches the DB (a legacy record, a direct DB edit),
 * the page emits the *rest* of its valid graph rather than poisoning the whole
 * payload. Better to lose one node than to serve invalid structured data.
 */
export function dropInvalidNodes(nodes: JsonLd[]): JsonLd[] {
  return nodes.filter((node) => !hasErrors(validateNode(node)));
}

/**
 * Parse an editor-authored custom JSON-LD string. Returns the nodes, or `null`
 * when the string is not valid JSON — callers omit it rather than emitting a
 * broken `<script>`. Accepts a single object or an array of objects.
 */
export function parseCustomJsonLd(raw?: string | null): JsonLd[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    if (!nodes.every((n) => n && typeof n === "object" && !Array.isArray(n))) {
      return null;
    }
    return nodes as JsonLd[];
  } catch {
    return null;
  }
}

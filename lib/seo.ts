/**
 * SEO — metadata builder + JSON-LD generators (Stage 3.4 / PRD §11).
 *
 * Pure & DB-free: every function takes already-loaded data (a clinic, a review,
 * breadcrumb items…) and returns a plain object — Next.js `Metadata` for
 * `generateMetadata`, or a JSON-LD object to drop into a `<script>` tag via
 * {@link renderJsonLd}. Page-level `seo` overrides win over Settings defaults,
 * which win over the `config/site.ts` constants.
 *
 * Schema.org types emitted (PRD §11 + AEO): `Organization`, `WebSite`,
 * `MedicalClinic`, `AggregateRating`, `Review`, `BreadcrumbList`, `FAQPage`,
 * `BlogPosting`, `MedicalWebPage`, `MedicalCondition`, `MedicalTherapy`,
 * `ItemList`, `WebPage`/`CollectionPage`/`AboutPage`/`ContactPage`, `Person`,
 * `ProfilePage`, `OfferCatalog`.
 *
 * **One graph, not N snippets.** Every node that references the publisher or the
 * site does so by `@id` (`…/#organization`, `…/#website`) rather than by
 * inlining another copy, and page-level nodes carry their own stable `@id`
 * (`…/clinic/acme#clinic`, `…#webpage`). See the "Node identity" section below —
 * it is the single change that most improves how a crawler reads this site.
 */
import type { Metadata } from "next";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
} from "@/config/site";
import {
  MAX_META_TITLE_LENGTH,
  META_SEPARATOR,
  boldMetaPrefix,
  normalizeMetaText,
} from "@/lib/meta-text";
import type { IClinic, IFaq, IReview, ISeo, ISeoDefaults } from "@/models";

// ── URL helpers ──────────────────────────────────────────────────────────────

/** Absolute URL for a root-relative path (idempotent for absolute inputs). */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export const clinicUrl = (slug: string): string =>
  absoluteUrl(`/clinic/${slug}`);
export const blogUrl = (slug: string): string => absoluteUrl(`/blog/${slug}`);

// ── Node identity (@id) ──────────────────────────────────────────────────────

/**
 * Stable `@id`s for the two site-wide nodes `<BaseSchema>` puts on every page.
 *
 * Why this matters more than it looks: without them each page emitted its own
 * anonymous copy of the publisher (`BlogPosting.publisher`, `WebPage.isPartOf`
 * …), so a crawler read one `Organization` per page and had no way to tell they
 * were the same entity. Pointing every reference at `…/#organization` collapses
 * that into a single node the whole site hangs off, which is what turns a pile
 * of per-page snippets into one connected knowledge graph.
 */
const trimSlash = (url: string): string => url.replace(/\/$/, "");

export const orgId = (siteUrl: string = SITE_URL): string =>
  `${trimSlash(siteUrl)}/#organization`;

export const websiteId = (siteUrl: string = SITE_URL): string =>
  `${trimSlash(siteUrl)}/#website`;

/** A page-scoped `@id`, e.g. `https://…/clinic/acme#clinic`. */
export const nodeId = (path: string, fragment: string): string =>
  `${absoluteUrl(path)}#${fragment}`;

/** A bare `@id` reference to another node in the same graph. */
const ref = (id: string): JsonLd => ({ "@id": id });

/**
 * Content language for every node that carries `inLanguage`. A single-locale
 * site, so a constant; it becomes a parameter the day a second locale ships.
 */
export const CONTENT_LANGUAGE = "en";

/**
 * Fallback title template used when Settings supply none — keeps every page
 * brand-suffixed even when the DB is unavailable at build time. Mirrors the
 * seeded `SiteSetting.seoDefaults.titleTemplate`. The pipe is the only
 * separator a meta tag may carry (see `lib/meta-text.ts`).
 */
export const DEFAULT_TITLE_TEMPLATE = `%s ${META_SEPARATOR} ${SITE_NAME}`;

/** Apply a Settings title template (e.g. `"%s | My Stem Cell Guide"`). */
export function applyTitleTemplate(title?: string, template?: string): string {
  if (!title) return SITE_NAME;
  if (!template) return title;
  return template.includes("%s") ? template.replace("%s", title) : title;
}

/**
 * The brand suffix, dropped when it is what pushes the title over the length
 * cap.
 *
 * A page title is written for the query; the brand on the end is a courtesy that
 * earns its place only while there is room for it. "Is Stem Cell Therapy Safe
 * for Arthritis? Benefits, Risks, and What to Know" is a good title at 74
 * characters and a truncated one at 95 once " | My Stem Cell Guide" is appended,
 * and the 21 characters a SERP drops to make room are the ones a reader was
 * going to use.
 *
 * Only the *suffix* is negotiable. Authored copy is never cut: a bare title that
 * is itself over the cap goes out whole and is reported by
 * `npm run check:meta`, because shortening someone's headline is an editorial
 * decision and not one to make silently in a metadata builder.
 */
function brandedTitle(title: string | undefined, template?: string): string {
  const bare = normalizeMetaText(title, "title");
  const branded = normalizeMetaText(
    applyTitleTemplate(title, template),
    "title",
  );
  if (branded.length <= MAX_META_TITLE_LENGTH || !bare) return branded;
  return bare.length < branded.length ? bare : branded;
}

// ── Metadata builder ─────────────────────────────────────────────────────────

export interface BuildMetadataInput {
  /** Page title (before the Settings template is applied). */
  title?: string;
  /**
   * The route already built the complete title, brand suffix included (or
   * deliberately excluded) — skip the Settings/`%s` template rather than append
   * to it. A per-entity `seo.metaTitle` still wins, as it always has.
   */
  titleAbsolute?: boolean;
  description?: string;
  /**
   * Lead phrase of the description to render in Unicode bold in the SERP
   * snippet. Matched against the *final* description, so an editor's override
   * that starts with the same phrase gets the bold too and one that doesn't
   * simply goes out plain. Only `<meta name="description">` is affected —
   * OG/Twitter keep the plain text. See `boldMetaPrefix` in lib/meta-text.ts.
   */
  boldDescriptionPrefix?: string;
  /** `<meta name="keywords">` terms. Omitted when empty. */
  keywords?: string[];
  /** Root-relative path for the canonical + OG url (e.g. `/clinic/acme`). */
  path?: string;
  /** OG/Twitter image URL (absolute or root-relative). */
  image?: string;
  /** OpenGraph type — `website` (default), `article`, `profile`. */
  type?: "website" | "article" | "profile";
  /** Per-entity overrides (`Clinic.seo`, `BlogPost` meta, …). */
  seo?: ISeo | null;
  /** Site-wide defaults from `SiteSetting.seoDefaults`. */
  defaults?: ISeoDefaults | null;
  /**
   * Route-level `noindex` for thin/filtered/paginated URLs (e.g. a directory
   * page carrying `?sort=` or `?page=2`, or an incomplete combination page).
   * OR-ed with the per-entity/global `seo.noindex`. See `lib/seo-indexation.ts`.
   */
  noindex?: boolean;
  /**
   * When `noindex` is set, whether to also stop following links. Defaults to
   * `false` so a thin page stays `noindex, follow` — it de-dupes from search
   * but still passes link equity through to canonical/child pages.
   */
  nofollow?: boolean;
}

/**
 * Build a Next.js `Metadata` object with title template, canonical, OpenGraph,
 * and Twitter cards. Precedence: `seo` override → `defaults` → config constant.
 *
 * The per-page override (`ISeo`) may additionally carry `ogTitle`/`ogDescription`
 * (distinct social copy), a `twitterCard` type, and granular `robots`
 * (`{index, follow}`). All are optional — a record that sets none behaves
 * exactly as before, which is what keeps this backward-compatible with every
 * existing document.
 */
export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const { seo, defaults } = input;

  // An explicit meta-title override is used **verbatim**: whoever typed it in
  // the admin panel typed the exact string they want in the SERP, brand suffix
  // and separator included. Only a route-supplied `title` gets the Settings
  // brand template applied — otherwise an override reading
  // "... | My Stem Cell Guide" would render as
  // "... | My Stem Cell Guide | My Stem Cell Guide".
  const titleOverride = seo?.metaTitle?.trim();
  // Every string below goes out through `normalizeMetaText`, so the two meta
  // rules (no em dash, the pipe is the only separator) hold for copy from any
  // source — a route file, the static-page registry, or a CMS record an editor
  // typed. On-page copy is untouched; only what reaches the `<head>` is
  // rewritten. See `lib/meta-text.ts`.
  const title =
    normalizeMetaText(titleOverride, "title") ||
    (input.titleAbsolute
      ? normalizeMetaText(input.title ?? SITE_NAME, "title")
      : brandedTitle(
          input.title,
          defaults?.titleTemplate ?? DEFAULT_TITLE_TEMPLATE,
        ));
  const description = normalizeMetaText(
    seo?.metaDescription ??
      input.description ??
      defaults?.metaDescription ??
      SITE_DESCRIPTION,
    "description",
  );
  // Bold is a `<meta name="description">` affordance only: a SERP snippet has no
  // markup, so the lead phrase is swapped for Unicode bold letters. OG/Twitter
  // stay on the plain `description` below — those surfaces render the string
  // as-is and math-alphanumeric code points would read as mangled text there.
  const metaDescription = boldMetaPrefix(
    description,
    input.boldDescriptionPrefix,
  );

  const canonical =
    seo?.canonicalUrl ?? (input.path ? absoluteUrl(input.path) : SITE_URL);

  const imageRaw = input.image ?? seo?.ogImage ?? defaults?.ogImage;
  const images = imageRaw ? [{ url: absoluteUrl(imageRaw) }] : undefined;

  // Social copy falls back to the page title/description when not overridden
  // (both already normalized); an override goes through the same rules.
  const ogTitle = seo?.ogTitle
    ? normalizeMetaText(seo.ogTitle, "title")
    : title;
  const ogDescription = seo?.ogDescription
    ? normalizeMetaText(seo.ogDescription, "description")
    : description;
  const twitterCard =
    seo?.twitterCard ?? defaults?.twitterCard ?? "summary_large_image";

  return {
    metadataBase: new URL(SITE_URL),
    // `absolute` opts out of the root layout's `title.template` so the brand
    // suffix (applied above via the Settings/default template) isn't appended a
    // second time — e.g. "All clinics | My Stem Cell Guide", not
    // "All clinics | My Stem Cell Guide | My Stem Cell Guide".
    title: { absolute: title },
    description: metaDescription,
    keywords: input.keywords?.length ? input.keywords : undefined,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: SITE_NAME,
      type: input.type ?? "website",
      images,
    },
    twitter: {
      card: twitterCard,
      title: ogTitle,
      description: ogDescription,
      images: images?.map((i) => i.url),
      site: defaults?.twitterHandle,
    },
    robots: resolveRobots(input),
  };
}

/**
 * Resolve the meta-robots directive.
 *
 * `noindex` is the coarse switch and is OR-ed across the route-level flag, the
 * per-entity override, and the global default (any one of them can suppress a
 * page). A page-level `robots.index === false` counts as a `noindex` too.
 *
 * `follow` defaults to `true` even when noindexed — a thin/filtered page should
 * stay `noindex, follow` so link equity still flows to its canonical and
 * children. An explicit `robots.follow: false` (or the route-level `nofollow`)
 * is what actually drops it.
 *
 * Returns `undefined` when the page is fully indexable and followable, so we
 * emit no robots tag at all rather than a redundant `index, follow`.
 */
function resolveRobots(input: BuildMetadataInput): Metadata["robots"] {
  const { seo, defaults } = input;
  const override = seo?.robots;

  const noindex = Boolean(
    input.noindex ||
    seo?.noindex ||
    defaults?.noindex ||
    override?.index === false,
  );
  const nofollow = Boolean(input.nofollow || override?.follow === false);

  if (!noindex && !nofollow) return undefined;
  return { index: !noindex, follow: !nofollow };
}

// ── JSON-LD ──────────────────────────────────────────────────────────────────

export type JsonLd = Record<string, unknown>;

/**
 * Serialize JSON-LD for `dangerouslySetInnerHTML`, escaping `<` so the payload
 * can never break out of the `<script>` element (XSS-safe).
 */
export function renderJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Drop empty/undefined keys so emitted JSON-LD stays clean. */
function compact<T extends JsonLd>(obj: T): T {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (
      v == null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0)
    ) {
      delete obj[key];
    }
  }
  return obj;
}

/**
 * The public policy pages that back a YMYL publisher's claims.
 *
 * Google's `Organization` reference does not list these, but they are valid
 * schema.org and they are how a health publisher states *in machine-readable
 * form* that it has an editorial process, a corrections route, and a disclosed
 * funding model. On a YMYL directory that is the cheapest E-E-A-T signal there
 * is: the pages already exist, they just were not being pointed at.
 */
export interface OrganizationPolicyPaths {
  /** Editorial standards → `/editorial-policy`. */
  publishingPrinciples?: string;
  /** How errors are corrected. */
  correctionsPolicy?: string;
  /** Ethical standards. */
  ethicsPolicy?: string;
  /** Where a reader reports a problem → `/contact`. */
  actionableFeedbackPolicy?: string;
  /** Who owns and funds the site → `/about`. */
  ownershipFundingInfo?: string;
}

/** Runtime identity for the site-wide nodes, resolved from admin Settings. */
export interface SiteIdentityInput {
  name?: string;
  url?: string;
  logo?: string;
  /** Authoritative profile URLs → `sameAs`. */
  sameAs?: string[];
  /** schema.org publisher type, e.g. `Organization` / `MedicalOrganization`. */
  type?: string;
  /** Path the sitelinks search box deep-links into. */
  searchPath?: string;
  /** One-paragraph description of the publisher (Google: recommended). */
  description?: string;
  /** Registered legal name, when it differs from the brand. */
  legalName?: string;
  alternateName?: string;
  /** Public contact email → `email` + `contactPoint.email`. */
  email?: string;
  /** Public contact phone → `telephone` + `contactPoint.telephone`. */
  telephone?: string;
  /**
   * Postal address. Settings stores this as one free-text line, and
   * `Organization.address` legitimately ranges over `Text` as well as
   * `PostalAddress` — emitting the text we actually have beats splitting it into
   * a `PostalAddress` whose parts we would be guessing at.
   */
  address?: string;
  /** ISO date (or year) the site launched. */
  foundingDate?: string;
  /** Subject-matter the publisher covers → helps entity resolution. */
  knowsAbout?: string[];
  /** Root-relative paths to the publisher's policy pages. */
  policies?: OrganizationPolicyPaths;
  /** Path of the contact page → `contactPoint.url`. */
  contactPath?: string;
}

/** `logo` as an `ImageObject` — Google reads the URL form, but the object form
 * is what lets the same image be referenced (and sized) elsewhere. */
function logoNode(logo: string | undefined, siteUrl: string): JsonLd | undefined {
  if (!logo) return undefined;
  return {
    "@type": "ImageObject",
    "@id": `${trimSlash(siteUrl)}/#logo`,
    url: absoluteUrl(logo),
    contentUrl: absoluteUrl(logo),
  };
}

/**
 * `Organization` for the publisher.
 *
 * Every field is overridable so the admin Settings (site name, uploaded logo,
 * social profiles, contact details) drive the node at runtime; the
 * `config/site.ts` constants are only the build-time fallback for when the DB is
 * unavailable. Passing no argument reproduces the original constants-only
 * behaviour.
 *
 * The `@type` stays `Organization` by default rather than `MedicalOrganization`,
 * and that is deliberate: this site is a directory and publisher, not a care
 * provider. `MedicalOrganization` asserts that the entity delivers healthcare,
 * which would be a false claim about *us* — the clinics we list carry it, and
 * they are the ones who actually treat patients. It remains configurable in
 * admin Settings for a deployment where the operator really is a provider.
 */
export function organizationJsonLd(opts: SiteIdentityInput = {}): JsonLd {
  const sameAs = (opts.sameAs ?? Object.values(SOCIAL_LINKS)).filter(Boolean);
  const siteUrl = opts.url ?? SITE_URL;
  const p = opts.policies ?? {};
  const contact =
    opts.email || opts.telephone || opts.contactPath
      ? compact({
          "@type": "ContactPoint",
          contactType: "customer support",
          email: opts.email,
          telephone: opts.telephone,
          url: opts.contactPath ? absoluteUrl(opts.contactPath) : undefined,
          availableLanguage: CONTENT_LANGUAGE,
        })
      : undefined;

  return compact({
    "@context": "https://schema.org",
    "@type": opts.type ?? "Organization",
    "@id": orgId(siteUrl),
    name: opts.name ?? SITE_NAME,
    legalName: opts.legalName,
    alternateName: opts.alternateName,
    url: siteUrl,
    logo: logoNode(opts.logo, siteUrl),
    // Google's Organization guidance treats `image` and `logo` separately;
    // repeating the logo as `image` is what makes the entity render an icon in
    // surfaces that read `image` and ignore `logo`.
    image: opts.logo ? absoluteUrl(opts.logo) : undefined,
    description: opts.description ?? SITE_DESCRIPTION,
    email: opts.email,
    telephone: opts.telephone,
    address: opts.address,
    foundingDate: opts.foundingDate,
    knowsAbout: opts.knowsAbout?.length ? opts.knowsAbout : undefined,
    contactPoint: contact,
    sameAs: sameAs.length ? sameAs : undefined,
    // Publisher-integrity signals. Absent keys simply drop out, so a deployment
    // that has not written these pages emits exactly what it did before.
    publishingPrinciples: p.publishingPrinciples
      ? absoluteUrl(p.publishingPrinciples)
      : undefined,
    correctionsPolicy: p.correctionsPolicy
      ? absoluteUrl(p.correctionsPolicy)
      : undefined,
    ethicsPolicy: p.ethicsPolicy ? absoluteUrl(p.ethicsPolicy) : undefined,
    actionableFeedbackPolicy: p.actionableFeedbackPolicy
      ? absoluteUrl(p.actionableFeedbackPolicy)
      : undefined,
    ownershipFundingInfo: p.ownershipFundingInfo
      ? absoluteUrl(p.ownershipFundingInfo)
      : undefined,
  });
}

/**
 * `WebSite` — the node that names the site and anchors every page's `isPartOf`.
 *
 * The `SearchAction` stays. Google retired the sitelinks search box on
 * 2024-11-21, so it no longer renders anything there, but Google explicitly says
 * unsupported structured data causes no harm and that *site names* still read a
 * variation of this same `WebSite` node — and other engines (and LLM crawlers)
 * do still act on `SearchAction`. Removing it would cost the site-name signal to
 * save nothing.
 */
export function websiteJsonLd(opts: SiteIdentityInput = {}): JsonLd {
  const siteUrl = opts.url ?? SITE_URL;
  const searchPath = opts.searchPath ?? "/search";
  return compact({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(siteUrl),
    name: opts.name ?? SITE_NAME,
    alternateName: opts.alternateName,
    url: siteUrl,
    description: opts.description ?? SITE_DESCRIPTION,
    inLanguage: CONTENT_LANGUAGE,
    publisher: ref(orgId(siteUrl)),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl(searchPath)}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

/**
 * Facts about a clinic that live on *populated* references rather than on the
 * clinic document itself (its treatments, conditions, accreditations, named
 * clinicians). The caller resolves them to plain names; this file never touches
 * Mongo. All optional, so an existing call site that passes a bare `IClinic`
 * keeps working and simply emits the smaller node it emitted before.
 */
export interface ClinicSeoExtras {
  /** Treatment names the clinic offers → `availableService` (`MedicalTherapy`). */
  services?: string[];
  /**
   * Condition names the clinic treats. Used only to derive `medicalSpecialty` —
   * the conditions themselves belong to the condition pages, not to this node.
   */
  conditions?: string[];
  /**
   * Accreditations held → `hasCredential`. Named `…Held` because `IClinic`
   * already has an `accreditations` field holding the unresolved ObjectIds, and
   * this is the resolved form.
   */
  accreditationsHeld?: { name: string; issuingBody?: string }[];
  /** Named clinicians (medical director, listed team) → `employee`. */
  staff?: { name: string; role?: string }[];
}

type ClinicSeoInput = Pick<
  IClinic,
  | "name"
  | "slug"
  | "description"
  | "tagline"
  | "logo"
  | "coverImage"
  | "website"
  | "ratingAvg"
  | "reviewCount"
  | "priceMin"
  | "priceMax"
  | "currency"
  | "locations"
  | "languages"
  | "foundedYear"
> &
  ClinicSeoExtras;

/**
 * schema.org `MedicalSpecialty` is a closed enumeration — 43 members, and
 * anything outside it is not a specialty, it is a string a validator ignores.
 * (The common mistake is `https://schema.org/Orthopedic`, which does not exist;
 * orthopaedics is `Musculoskeletal`.)
 *
 * Rather than store a specialty per clinic, derive it from the taxonomy the
 * clinic is already tagged with. Patterns are ordered most-specific-first and a
 * term that matches nothing contributes nothing — an unmapped term is better
 * than a guessed specialty, because a wrong `medicalSpecialty` on a health
 * business is a factual error about what that business treats.
 */
const SPECIALTY_PATTERNS: [RegExp, string][] = [
  [/rheumat|lupus|autoimmun|psoriatic|ankylosing/i, "Rheumatologic"],
  [
    /knee|hip|shoulder|joint|osteoarth|arthrit|cartilage|tendon|tendin|ligament|rotator|meniscus|spine|spinal disc|back pain|disc |orthop|musculoskelet|sports injur|fracture|bursitis|plantar/i,
    "Musculoskeletal",
  ],
  [
    /neuro|parkinson|alzheimer|dementia|multiple sclerosis|\bms\b|stroke|spinal cord|neuropath|traumatic brain|cerebral palsy|autism|epilep/i,
    "Neurologic",
  ],
  [/cardi|heart|vascular|ischemi|myocard/i, "Cardiovascular"],
  [/lung|pulmonar|copd|asthma|respirator|fibrosis/i, "Pulmonary"],
  [/kidney|renal|nephr/i, "Renal"],
  [/crohn|colitis|liver|hepat|gastro|bowel|\bibd\b|pancrea/i, "Gastroenterologic"],
  [
    /diabet|thyroid|hormone|testosterone|endocrin|menopause|\btrt\b|adrenal|metabolic/i,
    "Endocrine",
  ],
  [/erectile|urolog|prostate|bladder|peyronie/i, "Urologic"],
  [/fertilit|ovarian|gynec|endometri|vaginal|uterine/i, "Gynecologic"],
  [/cancer|oncolog|tumou?r|leukemi|lymphoma/i, "Oncologic"],
  [/retina|macular|ocular|optom|dry eye|glaucoma/i, "Optometric"],
  [/hearing|tinnitus|sinus|otolaryng/i, "Otolaryngologic"],
  [/skin|dermat|alopecia|hair loss|wound|scar|eczema|vitiligo/i, "Dermatology"],
  [/cosmetic|aesthetic|plastic surg|facial rejuven|breast/i, "PlasticSurgery"],
  [/physiotherap|physical therap|rehabilitat|prehab/i, "Physiotherapy"],
  [/anti-?ag|longevity|immune|wellness|\biv\b|systemic|whole-?body/i, "PrimaryCare"],
];

/**
 * Map free-text treatment/condition names onto `MedicalSpecialty` enum URLs.
 * Deduped, order-stable, and capped — a clinic claiming a dozen specialties
 * reads as noise, and the first few are the ones its taxonomy leans on.
 */
export function medicalSpecialtiesFor(
  terms: (string | undefined)[],
  limit = 5,
): string[] {
  const found: string[] = [];
  for (const term of terms) {
    if (!term) continue;
    for (const [pattern, specialty] of SPECIALTY_PATTERNS) {
      if (!pattern.test(term)) continue;
      if (!found.includes(specialty)) found.push(specialty);
      break;
    }
  }
  return found.slice(0, limit).map((s) => `https://schema.org/${s}`);
}

function postalAddress(loc: IClinic["locations"][number]): JsonLd {
  return compact({
    "@type": "PostalAddress",
    streetAddress: loc.addressLine,
    addressLocality: loc.city,
    addressRegion: loc.region,
    postalCode: loc.postalCode,
    addressCountry: loc.countryCode ?? loc.country,
  });
}

/**
 * `MedicalClinic` (a Schema.org `MedicalBusiness`/`LocalBusiness` subtype) with
 * an embedded `AggregateRating` when the clinic has approved reviews.
 *
 * Google requires `name` + `address` on a `LocalBusiness` and recommends
 * `telephone`, `geo`, `priceRange`, `url`, `image`, `aggregateRating` and
 * `review` — all of which this emits when the record has them. The
 * `aggregateRating`/`review` pair is specifically allowed here because Google
 * restricts it to "sites that capture reviews about *other* local businesses",
 * which is exactly what a third-party directory is; a clinic publishing the same
 * markup about itself would be the self-serving case Google disallows.
 *
 * `medicalSpecialty` and `availableService` are the two properties that make
 * this node say what the clinic actually *does* rather than just where it is.
 * Both are derived from the taxonomy the clinic is already tagged with, so they
 * cannot drift from what the page shows.
 */
export function medicalClinicJsonLd(clinic: ClinicSeoInput): JsonLd {
  const hq =
    clinic.locations?.find((l) => l.isHQ) ?? clinic.locations?.[0] ?? null;
  const image = clinic.coverImage?.url ?? clinic.logo?.url;
  const url = clinicUrl(clinic.slug);

  const specialties = medicalSpecialtiesFor([
    ...(clinic.conditions ?? []),
    ...(clinic.services ?? []),
  ]);

  // Every distinct country the clinic operates in. A directory profile covers
  // all of a group's sites even though `address` can only name the HQ.
  const areaServed = [
    ...new Set(
      (clinic.locations ?? [])
        .map((l) => l.country?.trim())
        .filter((c): c is string => Boolean(c)),
    ),
  ];

  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    "@id": `${url}#clinic`,
    name: clinic.name,
    url,
    mainEntityOfPage: url,
    description: clinic.description ?? clinic.tagline,
    image: image ? absoluteUrl(image) : undefined,
    logo: clinic.logo?.url ? absoluteUrl(clinic.logo.url) : undefined,
    sameAs: clinic.website || undefined,
    telephone: hq?.phone,
    address: hq ? postalAddress(hq) : undefined,
    geo:
      hq?.lat != null && hq?.lng != null
        ? { "@type": "GeoCoordinates", latitude: hq.lat, longitude: hq.lng }
        : undefined,
    areaServed: areaServed.length ? areaServed : undefined,
    // Closed enumeration — see `medicalSpecialtiesFor`. Emitted as a bare string
    // when there is one, since a single-element array reads as a list of one.
    medicalSpecialty:
      specialties.length === 1
        ? specialties[0]
        : specialties.length
          ? specialties
          : undefined,
    availableService: clinic.services?.length
      ? clinic.services.map((name) => ({ "@type": "MedicalTherapy", name }))
      : undefined,
    // `knowsLanguage`, not `availableLanguage`: the latter is only defined on
    // `ContactPoint`/`ServiceChannel`/`LodgingBusiness`, so a validator reads it
    // on a `MedicalClinic` as an inapplicable property and rejects the node.
    // `knowsLanguage` is declared on `Organization`, which `MedicalClinic`
    // inherits from through `MedicalOrganization`.
    knowsLanguage: clinic.languages?.length ? clinic.languages : undefined,
    // A year, not a full date — schema.org `Date` accepts ISO 8601 year form and
    // inventing a month/day we do not have would be worse than the coarser value.
    foundingDate: clinic.foundedYear ? String(clinic.foundedYear) : undefined,
    currenciesAccepted: clinic.currency,
    priceRange: priceRange(clinic),
    // Accreditations are the clinic's own E-E-A-T. `recognizedBy` names the
    // issuing body, which is the part that carries the weight.
    hasCredential: clinic.accreditationsHeld?.length
      ? clinic.accreditationsHeld.map((a) =>
          compact({
            "@type": "EducationalOccupationalCredential",
            name: a.name,
            credentialCategory: "Accreditation",
            recognizedBy: a.issuingBody
              ? { "@type": "Organization", name: a.issuingBody }
              : undefined,
          }),
        )
      : undefined,
    employee: clinic.staff?.length
      ? clinic.staff.map((p) =>
          compact({ "@type": "Person", name: p.name, jobTitle: p.role }),
        )
      : undefined,
    aggregateRating:
      clinic.reviewCount > 0 ? aggregateRatingJsonLd(clinic, false) : undefined,
  });
}

/** One priced line of a clinic's cost page. Structural, not a model import. */
export interface OfferItemInput {
  label: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  unit?: string;
}

/**
 * `OfferCatalog` for the clinic's published price list — attached to the
 * `MedicalClinic` node as `hasOfferCatalog` on the cost page only.
 *
 * A row with both bounds becomes a `PriceSpecification` carrying `minPrice`/
 * `maxPrice`; a row with one figure becomes a plain `price`, which is the form
 * schema.org (and every consumer of it) reads most reliably. Rows the clinic
 * quotes privately carry no figure at all and are skipped — an `Offer` without
 * a price is invalid, and inventing one would misstate what the clinic charges.
 *
 * Returns `undefined` when nothing is priced, so the caller can drop the key.
 */
export function offerCatalogJsonLd(
  items: OfferItemInput[],
  defaultCurrency = "USD",
  catalogName = "Published prices",
): JsonLd | undefined {
  const offers = items
    .filter((i) => i.priceMin != null || i.priceMax != null)
    .map((i) => {
      const currency = i.currency || defaultCurrency;
      const both = i.priceMin != null && i.priceMax != null;
      return compact({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: i.label },
        priceCurrency: currency,
        price: both ? undefined : (i.priceMin ?? i.priceMax),
        priceSpecification: both
          ? {
              "@type": "PriceSpecification",
              minPrice: i.priceMin,
              maxPrice: i.priceMax,
              priceCurrency: currency,
            }
          : undefined,
        unitText: i.unit,
      });
    });

  if (!offers.length) return undefined;
  return {
    "@type": "OfferCatalog",
    name: catalogName,
    itemListElement: offers,
  };
}

function priceRange(
  clinic: Pick<IClinic, "priceMin" | "priceMax" | "currency">,
): string | undefined {
  if (clinic.priceMin == null && clinic.priceMax == null) return undefined;
  const cur = clinic.currency ?? "USD";
  // A hyphen, not an en dash: the site's text policy keeps dashes out of
  // anything rendered (lib/meta-text.ts), and this string is rendered — it goes
  // into the page's JSON-LD and gets read back by whatever consumes it.
  if (clinic.priceMin != null && clinic.priceMax != null)
    return `${clinic.priceMin}-${clinic.priceMax} ${cur}`;
  return `${clinic.priceMin ?? clinic.priceMax} ${cur}`;
}

/**
 * `AggregateRating`. Standalone by default; pass `false` to get the bare node
 * for embedding inside another type (e.g. {@link medicalClinicJsonLd}).
 */
export function aggregateRatingJsonLd(
  clinic: Pick<IClinic, "ratingAvg" | "reviewCount">,
  standalone = true,
): JsonLd {
  return compact({
    ...(standalone ? { "@context": "https://schema.org" } : {}),
    "@type": "AggregateRating",
    ratingValue: clinic.ratingAvg,
    reviewCount: clinic.reviewCount,
    bestRating: 5,
    worstRating: 1,
  });
}

type ReviewSeoInput = Pick<
  IReview,
  "reviewer" | "ratingOverall" | "headline" | "body" | "createdAt"
> & { clinicName: string };

/**
 * `Review` node — reviewer is anonymized to "Verified Patient" (PRD §14).
 *
 * Standalone by default; pass `false` for the bare node to nest inside the type
 * being reviewed (see {@link medicalClinicJsonLd} / `buildClinicNodes`). The
 * nested form drops `itemReviewed` along with `@context`: the parent *is* the
 * reviewed item, and a stub `{"@type":"MedicalClinic","name":…}` standing in for
 * it is a second, address-less copy of the clinic that a validator rejects for
 * missing the fields a `LocalBusiness` needs.
 */
export function reviewJsonLd(
  review: ReviewSeoInput,
  standalone = true,
): JsonLd {
  const authorName =
    review.reviewer?.isAnonymous || !review.reviewer?.displayName
      ? "Verified Patient"
      : review.reviewer.displayName;
  const reviewBody =
    review.body?.experience ??
    review.body?.outcome ??
    review.body?.treatmentDescription;

  return compact({
    ...(standalone
      ? {
          "@context": "https://schema.org",
          itemReviewed: { "@type": "MedicalClinic", name: review.clinicName },
        }
      : {}),
    "@type": "Review",
    author: { "@type": "Person", name: authorName },
    reviewRating:
      review.ratingOverall != null
        ? {
            "@type": "Rating",
            ratingValue: review.ratingOverall,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    name: review.headline,
    reviewBody,
    datePublished: review.createdAt?.toISOString?.() ?? undefined,
  });
}

export interface BreadcrumbItem {
  name: string;
  /** Root-relative path or absolute URL. */
  path: string;
}

/** `BreadcrumbList` from an ordered list of crumbs. */
export function breadcrumbListJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// ── Blog (SEO-team posts) ────────────────────────────────────────────────────

export interface BlogPostingSeoInput {
  title: string;
  slug: string;
  excerpt?: string;
  coverImageUrl?: string;
  author?: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  /** Credentialed medical reviewer → `reviewedBy` Person node (E-E-A-T). */
  reviewer?: ReviewerSeoInput | null;
  /** ISO date/Date the post was last medically reviewed → `lastReviewed`. */
  lastReviewed?: Date | string | null;
  /**
   * Path of the author's bio page → `author.url`. Google explicitly recommends
   * linking an author to a profile page so the byline resolves to an entity
   * instead of staying a bare string.
   */
  authorPath?: string;
  /** Target terms → `keywords`. */
  keywords?: string[];
  /** Section/category the post sits in → `articleSection`. */
  section?: string;
  /** Body length in words → `wordCount`. */
  wordCount?: number;
}

const toIso = (d?: Date | string | null): string | undefined => {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** `BlogPosting` JSON-LD for a public /blog post (§5 technical SEO). */
export function blogPostingJsonLd(post: BlogPostingSeoInput): JsonLd {
  const url = blogUrl(post.slug);
  return compact({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: ref(websiteId()),
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? absoluteUrl(post.coverImageUrl) : undefined,
    url,
    inLanguage: CONTENT_LANGUAGE,
    datePublished: toIso(post.publishedAt),
    dateModified: toIso(post.updatedAt) ?? toIso(post.publishedAt),
    articleSection: post.section,
    keywords: post.keywords?.length ? post.keywords : undefined,
    wordCount: post.wordCount,
    author: post.author
      ? compact({
          "@type": "Person",
          name: post.author,
          url: post.authorPath ? absoluteUrl(post.authorPath) : undefined,
        })
      : ref(orgId()),
    // Medical-review provenance for YMYL health content (omitted when unset).
    reviewedBy: reviewerNode(post.reviewer),
    lastReviewed: toIso(post.lastReviewed),
    // Reference, not a second copy: `<BaseSchema>` already put the fully
    // described `Organization` on this page.
    publisher: ref(orgId()),
  });
}

/**
 * `FAQPage` from a clinic's (or a static page's) FAQ list (PRD §6.3).
 *
 * Worth being honest about what this now buys: Google retired the FAQ rich
 * result on 2024-08 for most sites and dropped it entirely on 2026-05, so this
 * node no longer produces stars-and-accordions in Google. It stays because it is
 * free, valid, and still the cleanest machine-readable form of a Q&A block for
 * the answer engines and LLM crawlers this site targets — but it should not be
 * treated as a ranking lever, and no page should be restructured to earn one.
 *
 * `path` is optional purely for backward compatibility; pass it so the node gets
 * an `@id` and joins the page's graph instead of floating free.
 */
export function faqPageJsonLd(
  faqs: Pick<IFaq, "question" | "answer">[],
  path?: string,
): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": path ? nodeId(path, "faq") : undefined,
    inLanguage: CONTENT_LANGUAGE,
    isPartOf: path ? ref(websiteId()) : undefined,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  });
}

// ── Medical / topical pages (taxonomy + combination pages, AEO) ───────────────

/** A credentialed medical reviewer, surfaced as a `Person` for E-E-A-T. */
export interface ReviewerSeoInput {
  name: string;
  /** Post-nominal credentials, e.g. "MD, PhD". */
  credentials?: string;
  /** Authoritative profile URLs (registry, ORCID, LinkedIn). */
  sameAs?: string[];
  /**
   * The reviewer's bio slug. Every byline shape in this app already carries it
   * (`ReviewerByline`), so accepting it here is what wires the whole site's
   * `reviewedBy` to one `Person` entity without touching a single page.
   */
  slug?: string;
  /** Explicit bio path, when it isn't `/reviewers/{slug}`. */
  path?: string;
  /** Role/title, e.g. "Regenerative Medicine Physician". */
  title?: string;
  /** Role/title (alias for {@link ReviewerSeoInput.title}). */
  jobTitle?: string;
}

/**
 * Build the `Person` node for a medical reviewer (or `undefined` if none).
 *
 * When the reviewer has a bio page, this emits an `@id` pointing at that page's
 * `Person` node. That is the difference between "some doctor called Jane Doe
 * checked this page" repeated fifty times, and one reviewer entity that fifty
 * pages demonstrably share — which is the whole point of reviewer attribution on
 * YMYL content.
 */
function reviewerNode(reviewer?: ReviewerSeoInput | null): JsonLd | undefined {
  if (!reviewer?.name) return undefined;
  const path =
    reviewer.path ?? (reviewer.slug ? `/reviewers/${reviewer.slug}` : undefined);
  return compact({
    "@type": "Person",
    "@id": path ? nodeId(path, "person") : undefined,
    name: reviewer.name,
    honorificSuffix: reviewer.credentials,
    jobTitle: reviewer.jobTitle ?? reviewer.title,
    url: path ? absoluteUrl(path) : undefined,
    sameAs: reviewer.sameAs?.length ? reviewer.sameAs : undefined,
  });
}

export interface MedicalWebPageSeoInput {
  name: string;
  description?: string;
  /** Root-relative path or absolute URL (canonical of the page). */
  path: string;
  /** ISO date or Date the page was last medically reviewed. */
  lastReviewed?: Date | string | null;
  /** ISO date or Date the page content was last modified. */
  dateModified?: Date | string | null;
  reviewedBy?: ReviewerSeoInput | null;
  /** The primary entity the page is about (a MedicalCondition/Therapy node). */
  about?: JsonLd;
  /**
   * `MedicalSpecialty` enum member, e.g. `"Musculoskeletal"`. Normalized to the
   * full `https://schema.org/…` URL, which is the form the enumeration takes —
   * a bare human-readable string like "Rheumatology" is not a member and is
   * silently ignored by anything that actually resolves the enum.
   */
  specialty?: string;
  /** Free-text terms to derive `specialty` from when none is set explicitly. */
  specialtyHints?: (string | undefined)[];
  /** Primary image of the page → `primaryImageOfPage`. */
  image?: string;
  datePublished?: Date | string | null;
}

/**
 * `MedicalWebPage` — the YMYL page wrapper carrying medical-review provenance
 * (`lastReviewed` + `reviewedBy`) and an `about` link to the condition/therapy
 * entity. Emit alongside the more specific `MedicalCondition`/`MedicalTherapy`
 * node (pass that node as `about`).
 *
 * `medicalAudience` is the property that says who the page is written for.
 * Without it a page describing a therapy is ambiguous between patient-facing
 * guidance and clinician reference material; this directory is unambiguously the
 * former, and saying so is the difference between a health page that resolves
 * cleanly and one that does not.
 */
export function medicalWebPageJsonLd(input: MedicalWebPageSeoInput): JsonLd {
  const url = absoluteUrl(input.path);
  const specialty =
    (input.specialty
      ? `https://schema.org/${input.specialty.replace(/^https?:\/\/schema\.org\//, "")}`
      : undefined) ?? medicalSpecialtiesFor(input.specialtyHints ?? [], 1)[0];

  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": `${url}#webpage`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: CONTENT_LANGUAGE,
    isPartOf: ref(websiteId()),
    primaryImageOfPage: input.image
      ? { "@type": "ImageObject", url: absoluteUrl(input.image) }
      : undefined,
    datePublished: toIso(input.datePublished),
    lastReviewed: toIso(input.lastReviewed),
    dateModified: toIso(input.dateModified) ?? toIso(input.lastReviewed),
    reviewedBy: reviewerNode(input.reviewedBy),
    // Patient-facing by definition — this is a consumer directory, not a
    // clinician reference.
    medicalAudience: {
      "@type": "MedicalAudience",
      audienceType: "Patient",
    },
    about: input.about,
    specialty,
    publisher: ref(orgId()),
  });
}

export interface MedicalConditionSeoInput {
  name: string;
  description?: string;
  path: string;
  /** Synonyms for entity matching, e.g. ["knee OA", "gonarthrosis"]. */
  alternateName?: string[];
  /** Names of therapies used for this condition (plain strings). */
  possibleTreatment?: string[];
}

/**
 * `MedicalCondition`. Attaches to condition pages and as the `about` of a
 * treatment×condition page. `alternateName` carries synonyms so answer engines
 * resolve the entity from any phrasing.
 */
export function medicalConditionJsonLd(
  input: MedicalConditionSeoInput,
): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalCondition",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    alternateName: input.alternateName?.length
      ? input.alternateName
      : undefined,
    possibleTreatment: input.possibleTreatment?.length
      ? input.possibleTreatment.map((name) => ({
          "@type": "MedicalTherapy",
          name,
        }))
      : undefined,
  });
}

export interface MedicalTherapySeoInput {
  name: string;
  description?: string;
  path: string;
  /** How the therapy is performed (e.g. delivery route), free text. */
  howPerformed?: string;
  /** Condition names this therapy is indicated for (plain strings). */
  indication?: string[];
}

/**
 * `MedicalTherapy` (a `MedicalProcedure` subtype — correct for cell/biologic
 * therapies). Attaches to treatment pages and all treatment×* combination
 * pages. Keep claims neutral — `description` is scanned for flagged phrases
 * upstream; this generator does not assert efficacy.
 */
export function medicalTherapyJsonLd(input: MedicalTherapySeoInput): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    howPerformed: input.howPerformed,
    indication: input.indication?.length
      ? input.indication.map((name) => ({
          "@type": "MedicalCondition",
          name,
        }))
      : undefined,
  });
}

export interface PersonSeoInput {
  name: string;
  path: string;
  credentials?: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  sameAs?: string[];
  /** Subjects the person is qualified on → `knowsAbout` (entity resolution). */
  knowsAbout?: string[];
  /** Stable record id → `identifier` (recommended on a `ProfilePage`). */
  identifier?: string;
  /** Whether the person reviews for us → `worksFor` the publisher. */
  affiliated?: boolean;
  standalone?: boolean;
}

/**
 * `Person` node for a medical reviewer's bio page — the E-E-A-T author entity
 * that `MedicalWebPage.reviewedBy` references across the site.
 *
 * The `@id` is the load-bearing part: it is the same `…#person` id every
 * `reviewedBy` on the site points at, so the reviewer is one entity with N
 * signed pages rather than N unrelated name strings.
 */
export function personJsonLd(input: PersonSeoInput): JsonLd {
  const url = absoluteUrl(input.path);
  return compact({
    ...(input.standalone === false ? {} : { "@context": "https://schema.org" }),
    "@type": "Person",
    "@id": `${url}#person`,
    name: input.name,
    url,
    mainEntityOfPage: url,
    honorificSuffix: input.credentials,
    jobTitle: input.jobTitle,
    description: input.description,
    image: input.image ? absoluteUrl(input.image) : undefined,
    identifier: input.identifier,
    knowsAbout: input.knowsAbout?.length ? input.knowsAbout : undefined,
    worksFor: input.affiliated === false ? undefined : ref(orgId()),
    sameAs: input.sameAs?.length ? input.sameAs : undefined,
  });
}

/**
 * `ProfilePage` wrapping a `Person` — the type Google documents for author and
 * "about me" pages, and one of the few structured-data features it still
 * actively supports.
 *
 * A bare `Person` says a person exists. `ProfilePage` says *this URL is that
 * person's profile*, which is what lets the byline on every reviewed page
 * resolve to a page Google can show. For a YMYL directory whose reviewer
 * attribution is the E-E-A-T story, that is the correct wrapper.
 */
export function profilePageJsonLd(input: {
  person: PersonSeoInput;
  dateCreated?: Date | string | null;
  dateModified?: Date | string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": nodeId(input.person.path, "profilepage"),
    url: absoluteUrl(input.person.path),
    inLanguage: CONTENT_LANGUAGE,
    isPartOf: ref(websiteId()),
    dateCreated: toIso(input.dateCreated),
    dateModified: toIso(input.dateModified) ?? toIso(input.dateCreated),
    mainEntity: personJsonLd({ ...input.person, standalone: false }),
  });
}

// ── Generic page wrappers (non-medical pages: composed pages + directories) ──

/** The `WebPage` subtypes we emit. `CollectionPage` marks a directory/index. */
export type WebPageType =
  | "WebPage"
  | "CollectionPage"
  | "AboutPage"
  | "ContactPage"
  | "FAQPage"
  | "ProfilePage";

export interface WebPageSeoInput {
  name: string;
  description?: string;
  /** Root-relative path or absolute URL (the page's canonical). */
  path: string;
  /** Narrower `@type` — defaults to `WebPage`. */
  type?: WebPageType;
  image?: string;
  datePublished?: Date | string | null;
  dateModified?: Date | string | null;
  /** The primary thing the page is about, as a nested node or an `@id` ref. */
  about?: JsonLd;
}

/**
 * A plain `WebPage`/`CollectionPage` wrapper for pages with no medical entity to
 * describe — editor-composed pages and directory/index pages. Medical topic
 * pages use {@link medicalWebPageJsonLd} instead, which additionally carries the
 * `reviewedBy`/`lastReviewed` YMYL provenance.
 *
 * `isPartOf` is an `@id` reference rather than an inline `WebSite`. It used to
 * be a fresh anonymous copy on every page, which meant a crawler saw one
 * unnamed website per URL instead of the single `WebSite` node `<BaseSchema>`
 * already publishes.
 */
export function webPageJsonLd(input: WebPageSeoInput): JsonLd {
  const url = absoluteUrl(input.path);
  return compact({
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    "@id": `${url}#webpage`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: CONTENT_LANGUAGE,
    image: input.image ? absoluteUrl(input.image) : undefined,
    primaryImageOfPage: input.image
      ? { "@type": "ImageObject", url: absoluteUrl(input.image) }
      : undefined,
    datePublished: toIso(input.datePublished),
    dateModified: toIso(input.dateModified) ?? toIso(input.datePublished),
    about: input.about,
    isPartOf: ref(websiteId()),
    publisher: ref(orgId()),
  });
}

export interface ItemListEntry {
  /** Root-relative path or absolute URL of the listed item. */
  path: string;
  name?: string;
  /** Thumbnail of the listed item. */
  image?: string;
}

export interface ItemListOptions {
  /** Human name of the list, e.g. "Top rated stem cell clinics". */
  name?: string;
  /** Root-relative path of the page the list is on → `@id`. */
  path?: string;
  /** `@type` of each listed thing, e.g. `MedicalClinic`. Omit for URL-only. */
  itemType?: string;
  /**
   * `@id` fragment the listed item carries on its own page, e.g. `clinic` for
   * the `…/clinic/acme#clinic` node. Set it and each entry points at the *same*
   * node the target page publishes, instead of introducing a near-duplicate.
   */
  itemIdFragment?: string;
}

/**
 * `ItemList` of the clinics (or terms, or posts) rendered on a listing page —
 * helps search and answer engines read the result set as one ordered set rather
 * than a wall of links. Only emit when there is at least one item.
 *
 * Note on expectations: Google's carousel rich result covers only Recipe,
 * Course, Restaurant and Movie, so an `ItemList` of clinics will not draw a
 * carousel. It earns its place as entity/ordering data for AI answer surfaces,
 * not as a SERP feature.
 *
 * When `itemType` is given each entry nests a typed `item` instead of a bare
 * `url` — the richer form, and the one that lets a consumer know the list is of
 * clinics without fetching every URL.
 */
export function itemListJsonLd(
  items: ItemListEntry[],
  opts: ItemListOptions = {},
): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": opts.path ? nodeId(opts.path, "itemlist") : undefined,
    name: opts.name,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) =>
      compact({
        "@type": "ListItem",
        position: i + 1,
        // A `ListItem` carries `url` *or* a nested `item`, not both — the two are
        // the summary-page and all-in-one forms of the same statement, and
        // emitting both just says it twice.
        url: opts.itemType ? undefined : absoluteUrl(item.path),
        name: opts.itemType ? undefined : item.name,
        item: opts.itemType
          ? compact({
              "@type": opts.itemType,
              "@id": opts.itemIdFragment
                ? nodeId(item.path, opts.itemIdFragment)
                : undefined,
              name: item.name,
              url: absoluteUrl(item.path),
              image: item.image ? absoluteUrl(item.image) : undefined,
            })
          : undefined,
      }),
    ),
  });
}

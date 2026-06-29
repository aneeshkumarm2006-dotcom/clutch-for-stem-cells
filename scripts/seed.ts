/**
 * Database seed — Stage 1.11.
 *
 * Seeds taxonomy (PRD §18), demo clinics/reviews/articles, listing plans, a
 * SuperAdmin user, and the default site settings. Denormalized rating fields,
 * `sortScore`, and taxonomy `clinicCount` are computed here (provisional — the
 * canonical jobs are `/lib/ratings.ts` §3.2 and `/lib/ranking.ts` §3.1).
 *
 * Usage:
 *   npm run seed            # wipe seed collections + insert (needs MONGODB_URI)
 *   npm run seed -- --dry   # build & schema-validate everything, no DB needed
 *
 * The seed REPLACES taxonomy/clinic/review/article/plan/settings collections and
 * the demo admin user. It does not touch leads or audit logs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose, {
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

import { dbConnect } from "@/lib/db";
import { SUB_RATING_KEYS, type SubRatingKey } from "@/lib/enums";
import { DEFAULT_CURRENCY, MEDICAL_DISCLAIMER, SITE_NAME } from "@/config/site";
import {
  Accreditation,
  Article,
  CellSource,
  Clinic,
  Condition,
  GLOBAL_SETTINGS_KEY,
  Location,
  Plan,
  Review,
  SiteSetting,
  Treatment,
  User,
  type IClinic,
  type ICondition,
  type IRatingBreakdown,
  type IReview,
  type ITopMention,
  type ITreatment,
} from "@/models";
import {
  ARTICLES,
  ACCREDITATIONS,
  CELL_SOURCES,
  CITIES,
  CLINICS,
  CONDITIONS,
  COUNTRIES,
  FEATURED_CLINIC_SLUGS,
  HERO,
  PLANS,
  POPULAR_SEARCHES,
  REVIEWS,
  TESTIMONIALS,
  TREATMENTS,
  type ClinicSeed,
} from "@/scripts/seed-data";

const DRY = process.argv.includes("--dry");
const ADMIN_EMAIL = "admin@stemconnect.example";

let dryErrors = 0;

// ── Small utilities ─────────────────────────────────────────────────────────

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** Load env from .env.local / .env (Next-style) so MONGODB_URI is available. */
async function loadEnv(): Promise<void> {
  try {
    const mod = await import("@next/env");
    mod.loadEnvConfig(process.cwd());
    return;
  } catch {
    // Fall back to a minimal parser if @next/env isn't resolvable.
  }
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      // file not present — ignore
    }
  }
}

/** Build hydrated docs from plain specs (assigns _id immediately, even offline). */
function build<T>(model: Model<T>, specs: object[]): HydratedDocument<T>[] {
  return specs.map((s) => new model(s as Partial<T>));
}

/** Insert (live) or schema-validate (dry) a batch of docs. */
async function commit<T>(
  model: Model<T>,
  docs: HydratedDocument<T>[],
  label: string,
): Promise<void> {
  if (DRY) {
    for (const doc of docs) {
      const err = doc.validateSync();
      if (err) {
        dryErrors += 1;
        log(`  ✗ ${label}: ${err.message}`);
      }
    }
    log(`  (dry) ${label}: ${docs.length} validated`);
    return;
  }
  if (docs.length) await model.insertMany(docs);
  log(`  ${label}: ${docs.length} inserted`);
}

// ── Rating / ranking computation (provisional — see §3.1/§3.2) ───────────────

function computeClinicRatings(
  clinicId: Types.ObjectId,
  reviews: HydratedDocument<IReview>[],
): Pick<
  IClinic,
  "ratingAvg" | "ratingBreakdown" | "reviewCount" | "topMentions"
> {
  const approved = reviews.filter(
    (r) => r.status === "approved" && r.clinicId.equals(clinicId),
  );
  const breakdown: IRatingBreakdown = {
    outcome: 0,
    communication: 0,
    facility: 0,
    value: 0,
    refer: 0,
  };
  if (approved.length === 0) {
    return {
      ratingAvg: 0,
      ratingBreakdown: breakdown,
      reviewCount: 0,
      topMentions: [],
    };
  }

  for (const key of SUB_RATING_KEYS) {
    const vals = approved
      .map((r) => r.ratings?.[key as SubRatingKey])
      .filter((v): v is number => typeof v === "number");
    breakdown[key] = round(mean(vals));
  }

  const tally = new Map<string, number>();
  for (const r of approved) {
    for (const tag of r.whyChosenTags ?? []) {
      tally.set(tag, (tally.get(tag) ?? 0) + 1);
    }
  }
  const topMentions: ITopMention[] = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  return {
    ratingAvg: round(mean(approved.map((r) => r.ratingOverall))),
    ratingBreakdown: breakdown,
    reviewCount: approved.length,
    topMentions,
  };
}

function completeness(c: HydratedDocument<IClinic>): number {
  const checks = [
    !!c.description,
    !!c.coverImage,
    c.gallery.length > 0,
    c.treatmentTypes.length > 0,
    c.accreditations.length > 0,
    c.caseStudies.length > 0,
    c.team.length > 0,
    c.priceMin != null,
  ];
  return checks.filter(Boolean).length / checks.length;
}

function computeSortScore(c: HydratedDocument<IClinic>): number {
  const normalizedRating = (c.ratingAvg || 0) / 5;
  const volume = Math.log1p(c.reviewCount || 0);
  const tierBoost = c.tier === "featured" ? 3 : c.tier === "verified" ? 1.5 : 0;
  const verifiedBoost = c.verification?.isVerified ? 1 : 0;
  return round(
    normalizedRating * 5 +
      volume +
      tierBoost +
      verifiedBoost +
      completeness(c) * 2,
    3,
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log(
    `\n🌱 Seeding ${SITE_NAME}${DRY ? " (dry run — no database writes)" : ""}\n`,
  );

  // 1) Taxonomy ──────────────────────────────────────────────────────────────
  const treatments = build(Treatment, TREATMENTS);
  const conditions = build(Condition, CONDITIONS);
  const cellSources = build(CellSource, CELL_SOURCES);
  const accreditations = build(Accreditation, ACCREDITATIONS);

  const tBySlug = indexBy(treatments);
  const cBySlug = indexBy(conditions);
  const csBySlug = indexBy(cellSources);
  const aBySlug = indexBy(accreditations);

  // Locations: countries first, then cities (parentId → country).
  const countries = build(
    Location,
    COUNTRIES.map((c) => ({
      name: c.name,
      slug: c.slug,
      kind: "country" as const,
      countryCode: c.countryCode,
      flag: c.flag,
      order: c.order ?? 0,
    })),
  );
  const countryBySlug = indexBy(countries);
  const cities = build(
    Location,
    CITIES.map((c) => ({
      name: c.name,
      slug: c.slug,
      kind: "city" as const,
      countryCode: c.countryCode,
      region: c.region,
      lat: c.lat,
      lng: c.lng,
      parentId: countryBySlug.get(c.parentCountrySlug)?._id ?? null,
    })),
  );

  // 2) Clinics ─────────────────────────────────────────────────────────────--
  const clinics = CLINICS.map(
    (spec) =>
      new Clinic(
        buildClinicDoc(spec, {
          treatment: tBySlug,
          condition: cBySlug,
          cellSource: csBySlug,
          accreditation: aBySlug,
        }),
      ),
  );
  const clinicBySlug = indexBy(clinics);

  // 3) Reviews (ref clinic + taxonomy) ────────────────────────────────────────
  const reviews = REVIEWS.map((r) => {
    const clinic = clinicBySlug.get(r.clinicSlug);
    if (!clinic)
      throw new Error(`Review references unknown clinic: ${r.clinicSlug}`);
    return new Review({
      clinicId: clinic._id,
      status: r.status,
      isVerified: r.isVerified ?? false,
      verificationMethod: r.verificationMethod,
      reviewer: r.reviewer,
      conditionId: r.conditionSlug
        ? cBySlug.get(r.conditionSlug)?._id
        : undefined,
      treatmentId: r.treatmentSlug
        ? tBySlug.get(r.treatmentSlug)?._id
        : undefined,
      treatmentDate: r.treatmentDate,
      cost: r.cost,
      ratingOverall: r.ratingOverall,
      ratings: r.ratings,
      headline: r.headline,
      body: r.body ?? {},
      whyChosenTags: r.whyChosenTags ?? [],
      wouldRecommend: r.wouldRecommend,
      providerResponse: r.providerResponse
        ? { ...r.providerResponse, respondedAt: new Date() }
        : undefined,
      // Demo reviews are pre-cleared; record consent/age as satisfied.
      consentGiven: true,
      ageConfirmed: true,
      ...(r.status === "approved"
        ? { moderation: { reviewedAt: new Date(), notes: "Approved (seed)" } }
        : {}),
    });
  });

  // 4) Denormalize ratings + sortScore onto clinics (before commit) ────────────
  for (const clinic of clinics) {
    const r = computeClinicRatings(clinic._id, reviews);
    clinic.ratingAvg = r.ratingAvg;
    clinic.ratingBreakdown = r.ratingBreakdown;
    clinic.reviewCount = r.reviewCount;
    clinic.topMentions = r.topMentions;
    clinic.sortScore = computeSortScore(clinic);
  }

  // 5) Taxonomy clinicCount from published clinics ────────────────────────────
  setRefCounts(treatments, clinics, "treatmentTypes");
  setRefCounts(conditions, clinics, "conditionsTreated");
  setRefCounts(cellSources, clinics, "cellSources");
  setRefCounts(accreditations, clinics, "accreditations");
  for (const country of countries) {
    country.clinicCount = clinics.filter(
      (c) =>
        c.status === "published" &&
        c.locations.some((l) => l.countryCode === country.countryCode),
    ).length;
  }
  for (const city of cities) {
    city.clinicCount = clinics.filter(
      (c) =>
        c.status === "published" &&
        c.locations.some((l) => l.city === city.name),
    ).length;
  }

  // 6) Articles ────────────────────────────────────────────────────────────--
  const articles = build(
    Article,
    ARTICLES.map((a) => ({
      title: a.title,
      slug: a.slug,
      status: a.status,
      excerpt: a.excerpt,
      body: a.body,
      author: a.author,
      categories: a.categories,
      tags: a.tags,
      relatedConditionIds: (a.relatedConditionSlugs ?? [])
        .map((s) => cBySlug.get(s)?._id)
        .filter((id): id is Types.ObjectId => !!id),
      relatedTreatmentIds: (a.relatedTreatmentSlugs ?? [])
        .map((s) => tBySlug.get(s)?._id)
        .filter((id): id is Types.ObjectId => !!id),
      readingTime: a.readingTime,
      publishedAt:
        a.status === "published"
          ? new Date(Date.now() - (a.publishedAtDaysAgo ?? 0) * 86_400_000)
          : null,
    })),
  );

  // 7) Plans ──────────────────────────────────────────────────────────────--
  const plans = build(Plan, PLANS);

  // 8) SuperAdmin user (no password — set after Stage 2 auth lands) ────────────
  const adminUser = new User({
    name: "StemConnect Admin",
    email: ADMIN_EMAIL,
    role: "superadmin",
    status: "active",
    provider: "credentials",
    emailVerified: new Date(),
  });

  // 9) Site settings singleton ─────────────────────────────────────────────---
  const settings = new SiteSetting({
    key: GLOBAL_SETTINGS_KEY,
    hero: HERO,
    popularSearches: POPULAR_SEARCHES,
    featuredClinicIds: FEATURED_CLINIC_SLUGS.map(
      (s) => clinicBySlug.get(s)?._id,
    ).filter((id): id is Types.ObjectId => !!id),
    testimonials: TESTIMONIALS,
    seoDefaults: {
      titleTemplate: `%s · ${SITE_NAME}`,
      metaTitle: `${SITE_NAME} — Find and trust regenerative-medicine clinics`,
      metaDescription:
        "Discover, compare, and review accredited stem cell and regenerative-medicine clinics worldwide.",
    },
    disclaimers: {
      medical: MEDICAL_DISCLAIMER,
      results: "Individual results vary and are not typical or guaranteed.",
      footer: MEDICAL_DISCLAIMER,
    },
    contact: { email: "hello@stemconnect.example" },
    // featureFlags / rankingWeights fall back to schema defaults.
  });

  // ── Persist ────────────────────────────────────────────────────────────────
  if (!DRY) {
    if (!process.env.MONGODB_URI) {
      log(
        "✗ MONGODB_URI is not set. Add it to site/.env.local, or run a dry validation:\n" +
          "    npm run seed -- --dry\n",
      );
      process.exitCode = 1;
      return;
    }
    await dbConnect();
    log("Connected. Clearing existing seed collections…");
    await clearCollections();
  }

  log("Writing documents:");
  await commit(Treatment, treatments, "treatments");
  await commit(Condition, conditions, "conditions");
  await commit(CellSource, cellSources, "cell sources");
  await commit(Accreditation, accreditations, "accreditations");
  await commit(Location, countries, "countries");
  await commit(Location, cities, "cities");
  await commit(Clinic, clinics, "clinics");
  await commit(Review, reviews, "reviews");
  await commit(Article, articles, "articles");
  await commit(Plan, plans, "plans");
  await commit(User, [adminUser], "admin user");
  await commit(SiteSetting, [settings], "site settings");

  if (DRY) {
    log(
      dryErrors === 0
        ? "\n✅ Dry run passed — every document validated against its schema.\n"
        : `\n❌ Dry run found ${dryErrors} validation error(s).\n`,
    );
    if (dryErrors > 0) process.exitCode = 1;
    return;
  }

  log(`\n✅ Seed complete.`);
  log(`   SuperAdmin user: ${ADMIN_EMAIL}`);
  log(
    `   NOTE: no password is set yet — once Stage 2 (Auth.js) lands, set one via\n` +
      `   the password-reset flow before signing in.\n`,
  );
  await mongoose.disconnect();
}

// ── Helpers that need model types ───────────────────────────────────────────

/** Map slug → hydrated doc for any taxonomy collection. */
function indexBy<T extends { slug: string; _id: Types.ObjectId }>(
  docs: HydratedDocument<T>[],
): Map<string, HydratedDocument<T>> {
  const map = new Map<string, HydratedDocument<T>>();
  for (const d of docs) map.set(d.slug, d);
  return map;
}

type SlugMap<T> = Map<string, HydratedDocument<T>>;

/** Resolve a clinic seed's slug references into a Mongoose-ready document. */
function buildClinicDoc(
  spec: ClinicSeed,
  maps: {
    treatment: SlugMap<ITreatment>;
    condition: SlugMap<ICondition>;
    cellSource: SlugMap<{ slug: string; _id: Types.ObjectId }>;
    accreditation: SlugMap<{ slug: string; _id: Types.ObjectId }>;
  },
): object {
  const tid = (slug: string) => maps.treatment.get(slug)?._id;
  const cityData = (citySlug: string) =>
    CITIES.find((c) => c.slug === citySlug);

  return {
    name: spec.name,
    slug: spec.slug,
    status: spec.status,
    tier: spec.tier,
    verification: {
      isVerified: spec.isVerified ?? false,
      badge: spec.badge,
      method: spec.verificationMethod,
      verifiedAt: spec.isVerified ? new Date() : null,
    },
    tagline: spec.tagline,
    description: spec.description,
    coverImage: spec.coverImage,
    treatmentTypes: spec.treatmentSlugs.map(tid).filter(Boolean),
    conditionsTreated: spec.conditionSlugs
      .map((s) => maps.condition.get(s)?._id)
      .filter(Boolean),
    cellSources: spec.cellSourceSlugs
      .map((s) => maps.cellSource.get(s)?._id)
      .filter(Boolean),
    serviceFocus: spec.serviceFocus
      .map((f) => ({ treatmentId: tid(f.treatmentSlug), percent: f.percent }))
      .filter((f) => f.treatmentId),
    accreditations: spec.accreditationSlugs
      .map((s) => maps.accreditation.get(s)?._id)
      .filter(Boolean),
    priceMin: spec.priceMin,
    priceMax: spec.priceMax,
    currency: spec.currency ?? DEFAULT_CURRENCY,
    priceModel: spec.priceModel,
    priceNote: spec.priceNote,
    foundedYear: spec.foundedYear,
    teamSize: spec.teamSize,
    physiciansCount: spec.physiciansCount,
    medicalDirector: spec.medicalDirector,
    team: spec.team ?? [],
    languages: spec.languages ?? [],
    locations: spec.locations.map((loc) => {
      const city = cityData(loc.citySlug);
      return {
        isHQ: loc.isHQ ?? false,
        addressLine: loc.addressLine,
        city: city?.name,
        region: city?.region,
        country: city?.country,
        countryCode: city?.countryCode,
        postalCode: loc.postalCode,
        lat: city?.lat,
        lng: city?.lng,
        phone: loc.phone,
      };
    }),
    website: spec.website,
    social: spec.social ?? {},
    contactEmail: spec.contactEmail,
    caseStudies: (spec.caseStudies ?? []).map((cs) => ({
      title: cs.title,
      conditionId: cs.conditionSlug
        ? maps.condition.get(cs.conditionSlug)?._id
        : undefined,
      summary: cs.summary,
      outcome: cs.outcome,
      isAnonymized: cs.isAnonymized ?? true,
    })),
    faqs: spec.faqs ?? [],
    highlights: spec.highlights ?? [],
  };
}

/** Set `clinicCount` on each taxonomy doc from published clinics' ref arrays. */
function setRefCounts<T extends { _id: Types.ObjectId; clinicCount: number }>(
  terms: HydratedDocument<T>[],
  clinics: HydratedDocument<IClinic>[],
  field:
    "treatmentTypes" | "conditionsTreated" | "cellSources" | "accreditations",
): void {
  for (const term of terms) {
    term.clinicCount = clinics.filter(
      (c) =>
        c.status === "published" && c[field].some((id) => id.equals(term._id)),
    ).length;
  }
}

async function clearCollections(): Promise<void> {
  await Promise.all([
    Treatment.deleteMany({}),
    Condition.deleteMany({}),
    CellSource.deleteMany({}),
    Accreditation.deleteMany({}),
    Location.deleteMany({}),
    Clinic.deleteMany({}),
    Review.deleteMany({}),
    Article.deleteMany({}),
    Plan.deleteMany({}),
    SiteSetting.deleteMany({ key: GLOBAL_SETTINGS_KEY }),
    User.deleteOne({ email: ADMIN_EMAIL }),
  ]);
}

// ── Entry point ─────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  await loadEnv();
  await main();
}

run()
  .then(() => {
    if (!DRY) process.exit(process.exitCode ?? 0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("\n✗ Seed failed:", err);
    process.exit(1);
  });

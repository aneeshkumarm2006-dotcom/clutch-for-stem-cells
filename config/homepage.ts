/**
 * Homepage (landing page) content model — the single description of everything
 * the `/` route renders.
 *
 * The homepage used to be half config, half hardcoded JSX: the hero, popular
 * searches, featured clinics and testimonials came from `SiteSetting`, while
 * every section heading, the knee/joint cards, the "how it works" steps, the
 * cost/benefits columns, the trust strip, the for-clinics band and the FAQ (which
 * is also the page's `FAQPage` JSON-LD) were strings in the component. This
 * module makes the whole page editable without touching either half's storage:
 *
 *  - {@link HOMEPAGE_DEFAULTS} is the shipped copy — the exact strings that used
 *    to live in the JSX. It is what renders when nothing is stored, and what the
 *    admin form shows as placeholder text, so an editor always sees the live
 *    value rather than a copy that can drift.
 *  - {@link resolveHomepage} layers whatever an editor saved on top, field by
 *    field. A blank stored string means "not set" and falls through to the
 *    default, which is what makes clearing a field in the admin restore the
 *    shipped copy instead of blanking the page.
 *
 * Storage is split deliberately. The four pieces that already had a home
 * (`hero`, `popularSearches`, `testimonials`, `featuredClinicIds`) stay where
 * they are so no existing content has to move; everything new lives under
 * `SiteSetting.homepage`. {@link resolveHomepage} is what hides that seam from
 * both the page and the admin form.
 *
 * No server-only imports: the admin client form imports the defaults for its
 * placeholders.
 */

// ── Value objects ───────────────────────────────────────────────────────────

export interface HomepageImage {
  url: string;
  alt?: string;
  publicId?: string;
  width?: number;
  height?: number;
}

export interface HomepageLink {
  label: string;
  href: string;
}

/** A linked card in the highlight row (the knee/joint cluster by default). */
export interface HomepageCard {
  title: string;
  body: string;
  href: string;
}

/** One numbered "how it works" step. `icon` keys into {@link HOMEPAGE_ICONS}. */
export interface HomepageStep {
  icon: string;
  title: string;
  body: string;
}

export interface HomepageFaqItem {
  question: string;
  answer: string;
}

export interface HomepageTestimonial {
  quote: string;
  author?: string;
  role?: string;
  location?: string;
  rating?: number;
}

/** Which stock disclaimer to print under a block; `none` prints nothing. */
export type HomepageDisclaimer = "none" | "medical" | "results" | "pricing";

export const HOMEPAGE_DISCLAIMERS: HomepageDisclaimer[] = [
  "none",
  "medical",
  "results",
  "pricing",
];

/** One column of the two-up cost/benefits block. */
export interface HomepageColumn {
  title: string;
  intro: string;
  bullets: string[];
  outro: string;
  ctaLabel: string;
  ctaHref: string;
  disclaimer: HomepageDisclaimer;
}

/**
 * The icons an editor can pick for a "how it works" step. Keys only — the
 * lucide components are mapped in the page, so this stays importable from a
 * client component without pulling icon code into the admin bundle.
 */
export const HOMEPAGE_ICONS = [
  "search",
  "sliders",
  "message",
  "shield",
  "star",
  "heart",
  "stethoscope",
  "map-pin",
  "calendar",
  "check",
  "users",
  "sparkles",
] as const;

export type HomepageIcon = (typeof HOMEPAGE_ICONS)[number];

// ── Section shapes ──────────────────────────────────────────────────────────

/** A section that heads a grid pulled from the database (taxonomy, clinics). */
export interface HomepageFeedSection {
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  linkLabel: string;
  linkHref: string;
  /** How many items the grid shows. */
  limit: number;
}

export interface HomepageContent {
  hero: {
    headline: string;
    subhead: string;
    ctaPrimaryLabel: string;
    ctaPrimaryHref: string;
    ctaSecondaryLabel: string;
    ctaSecondaryHref: string;
    /** Show the directory search bar between the subhead and the CTAs. */
    showSearch: boolean;
    /** Label in front of the popular-search chips. */
    popularLabel: string;
    backgroundImage?: HomepageImage;
  };
  popularSearches: HomepageLink[];
  treatments: HomepageFeedSection;
  conditions: HomepageFeedSection;
  /** The static card row — "Stem cell therapy for knees and joints" by default. */
  highlights: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    description: string;
    cards: HomepageCard[];
  };
  destinations: HomepageFeedSection;
  featured: HomepageFeedSection;
  howItWorks: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    description: string;
    steps: HomepageStep[];
  };
  costBenefits: {
    enabled: boolean;
    columns: HomepageColumn[];
  };
  trust: {
    enabled: boolean;
    badge: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
    showStats: boolean;
    clinicsLabel: string;
    verifiedLabel: string;
    reviewsLabel: string;
  };
  testimonials: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    description: string;
    /** Overrides the stock results-vary note printed under the quotes. */
    note: string;
    items: HomepageTestimonial[];
  };
  forClinics: {
    enabled: boolean;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
  faq: {
    enabled: boolean;
    heading: string;
    items: HomepageFaqItem[];
    moreLabel: string;
    moreHref: string;
    /** Emit the items as `FAQPage` JSON-LD (independent of rendering them). */
    emitJsonLd: boolean;
  };
  blog: HomepageFeedSection;
  /**
   * `<meta name="keywords">` for `/`. Title, description, OG and robots are not
   * here — those live in `SiteSetting.pageSeo` under `/`, the same store
   * `/admin/seo` writes, so there is exactly one source of truth for them.
   */
  keywords: string[];
}

// ── Shipped copy ────────────────────────────────────────────────────────────

export const HOMEPAGE_DEFAULTS: HomepageContent = {
  hero: {
    headline:
      "Find and compare trusted regenerative medicine clinics with My Stem Cell Guide.",
    subhead:
      "Compare accredited stem cell clinics worldwide by treatment, condition, location, pricing, and verified patient reviews to help you make a more informed healthcare decision.",
    ctaPrimaryLabel: "Find a clinic",
    ctaPrimaryHref: "/find-a-clinic",
    ctaSecondaryLabel: "Browse all clinics",
    ctaSecondaryHref: "/clinics",
    showSearch: true,
    popularLabel: "Popular:",
  },
  popularSearches: [
    { label: "Knee osteoarthritis", href: "/conditions/knee-osteoarthritis" },
    { label: "MSC therapy", href: "/treatments/msc-therapy" },
    { label: "Anti-aging", href: "/conditions/anti-aging-longevity" },
    { label: "Clinics in Mexico", href: "/locations/mexico" },
  ],
  treatments: {
    enabled: true,
    eyebrow: "",
    title: "Browse by type of stem cell therapy",
    description:
      "Compare stem cell clinics offering mesenchymal stem cell (MSC), autologous, bone marrow-derived, umbilical cord, exosome, PRP, and systemic therapies for a wide range of medical conditions.",
    linkLabel: "All treatments",
    linkHref: "/treatments",
    limit: 9,
  },
  conditions: {
    enabled: true,
    eyebrow: "",
    title: "Browse by condition",
    description:
      "Compare stem cell therapy options for knee arthritis, joint pain, neurological disorders, autoimmune conditions, and anti-aging care across verified clinics.",
    linkLabel: "All conditions",
    linkHref: "/conditions",
    limit: 9,
  },
  highlights: {
    enabled: true,
    eyebrow: "Most researched",
    title: "Stem cell therapy for knees and joints",
    description:
      "Knee pain is what brings most people here. Start with whichever of these is closest to your situation.",
    cards: [
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
    ],
  },
  destinations: {
    enabled: true,
    eyebrow: "",
    title: "Browse by destination",
    // Only names countries that actually have published listings. Naming an
    // empty destination sends people to a page with nothing on it, and the
    // thin-term soft-404 gate would keep that page out of the index anyway.
    description:
      "Compare regenerative medicine clinics across popular medical travel destinations including the United States, Mexico, Panama, and South Korea.",
    linkLabel: "All destinations",
    linkHref: "/locations",
    limit: 8,
  },
  featured: {
    enabled: true,
    eyebrow: "Featured",
    title: "Top-rated clinics",
    description:
      "A mix of editor-curated and highly rated verified clinics. Featured placement is labelled and explained on our methodology page.",
    linkLabel: "Browse all clinics",
    linkHref: "/clinics",
    limit: 4,
  },
  howItWorks: {
    enabled: true,
    eyebrow: "",
    title: "How it works",
    description: "Three steps from research to a confident decision.",
    steps: [
      {
        icon: "search",
        title: "Browse",
        body: "Search and filter clinics by treatment, condition, location, price, and verified reviews.",
      },
      {
        icon: "sliders",
        title: "Compare",
        body: "Review profiles, accreditations, pricing, and real patient experiences side by side.",
      },
      {
        icon: "message",
        title: "Connect",
        body: "Request a consultation or get matched with clinics that fit your needs.",
      },
    ],
  },
  costBenefits: {
    enabled: true,
    columns: [
      {
        title: "What does stem cell treatment cost?",
        intro:
          "There is no flat stem cell treatment price. Four things move it more than anything else:",
        bullets: [
          "The cell source: your own cells in autologous or bone-marrow-derived therapy, or screened donor cells in umbilical-cord therapy.",
          "Cell count, and how many sessions the protocol runs to.",
          "One injection into a single joint versus IV or systemic cell therapy.",
          "The country, the clinic's accreditation, and whether travel and aftercare are bundled in.",
        ],
        outro:
          "Every listing shows the clinic's own indicative starting price, so you can filter by budget instead of guessing at a number.",
        ctaLabel: "Compare clinics by price",
        ctaHref: "/clinics",
        disclaimer: "pricing",
      },
      {
        title: "Stem cell benefits, and the honest limits",
        intro:
          "People researching therapy with stem cells tend to want the same stem cell treatment benefits: less pain, more movement, and a path that isn't surgery. How strongly the research backs that up depends on the condition and on the treatment, and it is still developing for most uses.",
        bullets: [],
        outro:
          "So compare on the things you can actually check: what cells a clinic uses, what its protocol involves, what it costs, what accreditation it holds, and what patients said afterwards. Any clinic promising you a certain outcome is telling you something useful about itself.",
        ctaLabel: "How we verify and rank clinics",
        ctaHref: "/methodology",
        disclaimer: "medical",
      },
    ],
  },
  trust: {
    enabled: true,
    badge: "Verification you can check",
    title: "Curated listings and verified patient reviews",
    body: "Verification is based on accreditation and record checks, and it is not an endorsement of any treatment's safety or efficacy. Learn how clinics are ranked and verified.",
    ctaLabel: "Read our methodology",
    ctaHref: "/methodology",
    showStats: true,
    clinicsLabel: "Clinics",
    verifiedLabel: "Verified",
    reviewsLabel: "Patient reviews",
  },
  testimonials: {
    enabled: true,
    eyebrow: "",
    title: "What patients say",
    description:
      "Experiences shared by patients who used My Stem Cell Guide to research clinics.",
    note: "Testimonials reflect individual experiences. Individual results vary and are not typical or guaranteed.",
    items: [],
  },
  forClinics: {
    enabled: true,
    title: "Are you a regenerative-medicine clinic?",
    body: "Get listed for free, build trust with verification, and receive qualified patient inquiries.",
    ctaLabel: "Get listed",
    ctaHref: "/for-clinics",
  },
  faq: {
    enabled: true,
    heading: "Stem cell therapy: common questions",
    emitJsonLd: true,
    moreLabel: "More questions about using this guide",
    moreHref: "/faq",
    items: [
      {
        question: "How do I choose the right stem cell clinic?",
        answer:
          "Choosing the right stem cell clinic involves more than comparing prices. Look for clinic accreditation, physician experience, available treatment options, verified patient reviews, and transparent pricing. My Stem Cell Guide helps you compare trusted clinics by treatment, condition, location, and patient feedback so you can make a more informed decision.",
      },
      {
        question: "How much does stem cell therapy cost?",
        answer:
          "The cost of stem cell therapy varies with the treatment type, the cell source, the condition being treated, the clinic, and the country. A single knee injection sits at the low end, a multi-day systemic protocol with follow-up at the high end. Every listing shows the clinic's own indicative starting price, so you can compare stem cell treatment cost and filter the directory by budget.",
      },
      {
        question: "What conditions can stem cell therapy help treat?",
        answer:
          "Many patients research stem cell therapy for conditions such as knee osteoarthritis, joint pain, sports injuries, autoimmune disorders, neurological conditions, and anti-aging treatments. Available therapies and treatment approaches differ between clinics, so it is worth comparing providers against your specific condition rather than in general.",
      },
      {
        question: "What is mesenchymal stem cell (MSC) therapy?",
        answer:
          "Mesenchymal stem cell (MSC) therapy uses cells sourced from bone marrow, fat tissue, or umbilical cord tissue, which are being studied for their regenerative and anti-inflammatory properties. MSC therapy is commonly explored for orthopedic, autoimmune, and neurological conditions, and clinics differ in where they source the cells and how many a protocol uses. Compare clinics offering MSC therapy and other regenerative medicine treatments here.",
      },
      {
        question: "How can I compare stem cell clinics worldwide?",
        answer:
          "Comparing stem cell clinics worldwide is easier when treatments, accreditation, pricing, patient reviews, and locations sit in one place. My Stem Cell Guide lets you research regenerative medicine clinics across multiple countries side by side, so you can shortlist on the things you can actually check before you contact anyone.",
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
        question:
          "What is the difference between autologous and umbilical-cord therapy?",
        answer:
          "Autologous therapy uses your own cells, harvested on the day from fat or marrow, and bone-marrow-derived therapy is one form of it. Umbilical-cord therapy uses screened donor cells and skips the harvest step. Which one you can access depends on the regulations where the clinic operates.",
      },
      {
        question: "What is systemic cell therapy?",
        answer:
          "Systemic (IV) cell therapy delivers cells into the bloodstream rather than into a single joint, so clinics tend to price it per protocol rather than per injection. It is usually discussed for whole-body or autoimmune concerns rather than one painful knee.",
      },
    ],
  },
  blog: {
    enabled: true,
    eyebrow: "",
    title: "From the blog",
    description:
      "Guides, updates, and insights to help you research regenerative medicine.",
    linkLabel: "All blog posts",
    linkHref: "/blog",
    limit: 3,
  },
  keywords: [
    "my stem cell guide",
    "stem cell guide",
    "stem cell clinics worldwide",
    "compare stem cell clinics",
    "regenerative medicine clinics",
    "stem cell treatment",
    "stem cell therapy",
    "stem cell cost",
    "stem cell treatment price",
    "stem cell benefits",
    "stem cell treatment benefits",
  ],
};

// ── Resolver ────────────────────────────────────────────────────────────────

/** What `resolveHomepage` accepts: any subset of the stored shape. */
export type HomepageOverrides = DeepPartial<HomepageContent>;

type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** The legacy top-level `SiteSetting` fields the homepage still reads from. */
export interface HomepageLegacySource {
  hero?: {
    headline?: string;
    subhead?: string;
    ctaPrimaryLabel?: string;
    ctaSecondaryLabel?: string;
    backgroundImage?: HomepageImage | null;
  } | null;
  popularSearches?: { label: string; href: string }[] | null;
  testimonials?: HomepageTestimonial[] | null;
}

/** A stored string counts only when it has content — blank means "use the default". */
function str(stored: unknown, fallback: string): string {
  return typeof stored === "string" && stored.trim() ? stored : fallback;
}

function bool(stored: unknown, fallback: boolean): boolean {
  return typeof stored === "boolean" ? stored : fallback;
}

function num(stored: unknown, fallback: number): number {
  return typeof stored === "number" && Number.isFinite(stored) && stored > 0
    ? Math.floor(stored)
    : fallback;
}

/** A stored list counts only when non-empty — an empty grid is never intended. */
function list<T>(stored: unknown, fallback: T[]): T[] {
  return Array.isArray(stored) && stored.length > 0 ? (stored as T[]) : fallback;
}

function feed(
  stored: DeepPartial<HomepageFeedSection> | undefined,
  fallback: HomepageFeedSection,
): HomepageFeedSection {
  return {
    enabled: bool(stored?.enabled, fallback.enabled),
    eyebrow: str(stored?.eyebrow, fallback.eyebrow),
    title: str(stored?.title, fallback.title),
    description: str(stored?.description, fallback.description),
    linkLabel: str(stored?.linkLabel, fallback.linkLabel),
    linkHref: str(stored?.linkHref, fallback.linkHref),
    limit: num(stored?.limit, fallback.limit),
  };
}

function column(
  stored: DeepPartial<HomepageColumn> | undefined,
  fallback: HomepageColumn,
): HomepageColumn {
  const bullets = Array.isArray(stored?.bullets)
    ? (stored.bullets as string[]).filter((b) => b.trim())
    : undefined;
  return {
    title: str(stored?.title, fallback.title),
    intro: str(stored?.intro, fallback.intro),
    // Bullets are the one list where empty is a real choice — the second column
    // ships without any — so an explicitly stored array wins even when empty.
    bullets: bullets ?? fallback.bullets,
    outro: str(stored?.outro, fallback.outro),
    ctaLabel: str(stored?.ctaLabel, fallback.ctaLabel),
    ctaHref: str(stored?.ctaHref, fallback.ctaHref),
    disclaimer: HOMEPAGE_DISCLAIMERS.includes(
      stored?.disclaimer as HomepageDisclaimer,
    )
      ? (stored!.disclaimer as HomepageDisclaimer)
      : fallback.disclaimer,
  };
}

/**
 * Merge stored homepage content over the shipped defaults.
 *
 * `overrides` is `SiteSetting.homepage`; `legacy` carries the four fields that
 * predate it and keep their original storage (hero, popular searches,
 * testimonials). Anything blank, missing, or an empty list falls through to
 * {@link HOMEPAGE_DEFAULTS}, so the page can never render an empty section
 * because someone cleared a field.
 */
export function resolveHomepage(
  overrides?: HomepageOverrides | null,
  legacy?: HomepageLegacySource | null,
): HomepageContent {
  const d = HOMEPAGE_DEFAULTS;
  const o = overrides ?? {};

  const heroImage = legacy?.hero?.backgroundImage;

  return {
    hero: {
      headline: str(legacy?.hero?.headline, d.hero.headline),
      subhead: str(legacy?.hero?.subhead, d.hero.subhead),
      ctaPrimaryLabel: str(
        legacy?.hero?.ctaPrimaryLabel,
        d.hero.ctaPrimaryLabel,
      ),
      ctaPrimaryHref: str(o.hero?.ctaPrimaryHref, d.hero.ctaPrimaryHref),
      ctaSecondaryLabel: str(
        legacy?.hero?.ctaSecondaryLabel,
        d.hero.ctaSecondaryLabel,
      ),
      ctaSecondaryHref: str(o.hero?.ctaSecondaryHref, d.hero.ctaSecondaryHref),
      showSearch: bool(o.hero?.showSearch, d.hero.showSearch),
      popularLabel: str(o.hero?.popularLabel, d.hero.popularLabel),
      backgroundImage: heroImage?.url ? heroImage : undefined,
    },
    popularSearches: list(
      legacy?.popularSearches?.filter((p) => p?.label && p?.href),
      d.popularSearches,
    ),
    treatments: feed(o.treatments, d.treatments),
    conditions: feed(o.conditions, d.conditions),
    highlights: {
      enabled: bool(o.highlights?.enabled, d.highlights.enabled),
      eyebrow: str(o.highlights?.eyebrow, d.highlights.eyebrow),
      title: str(o.highlights?.title, d.highlights.title),
      description: str(o.highlights?.description, d.highlights.description),
      cards: list(
        (o.highlights?.cards as HomepageCard[] | undefined)?.filter(
          (c) => c?.title && c?.href,
        ),
        d.highlights.cards,
      ),
    },
    destinations: feed(o.destinations, d.destinations),
    featured: feed(o.featured, d.featured),
    howItWorks: {
      enabled: bool(o.howItWorks?.enabled, d.howItWorks.enabled),
      eyebrow: str(o.howItWorks?.eyebrow, d.howItWorks.eyebrow),
      title: str(o.howItWorks?.title, d.howItWorks.title),
      description: str(o.howItWorks?.description, d.howItWorks.description),
      steps: list(
        (o.howItWorks?.steps as HomepageStep[] | undefined)?.filter(
          (s) => s?.title,
        ),
        d.howItWorks.steps,
      ),
    },
    costBenefits: {
      enabled: bool(o.costBenefits?.enabled, d.costBenefits.enabled),
      columns: d.costBenefits.columns.map((fallback, i) =>
        column(
          (o.costBenefits?.columns as HomepageColumn[] | undefined)?.[i],
          fallback,
        ),
      ),
    },
    trust: {
      enabled: bool(o.trust?.enabled, d.trust.enabled),
      badge: str(o.trust?.badge, d.trust.badge),
      title: str(o.trust?.title, d.trust.title),
      body: str(o.trust?.body, d.trust.body),
      ctaLabel: str(o.trust?.ctaLabel, d.trust.ctaLabel),
      ctaHref: str(o.trust?.ctaHref, d.trust.ctaHref),
      showStats: bool(o.trust?.showStats, d.trust.showStats),
      clinicsLabel: str(o.trust?.clinicsLabel, d.trust.clinicsLabel),
      verifiedLabel: str(o.trust?.verifiedLabel, d.trust.verifiedLabel),
      reviewsLabel: str(o.trust?.reviewsLabel, d.trust.reviewsLabel),
    },
    testimonials: {
      enabled: bool(o.testimonials?.enabled, d.testimonials.enabled),
      eyebrow: str(o.testimonials?.eyebrow, d.testimonials.eyebrow),
      title: str(o.testimonials?.title, d.testimonials.title),
      description: str(o.testimonials?.description, d.testimonials.description),
      note: str(o.testimonials?.note, d.testimonials.note),
      // Unlike every other list, no stored testimonials means the section is
      // simply absent — there is no shipped quote to fall back to.
      items: (legacy?.testimonials ?? []).filter((t) => t?.quote?.trim()),
    },
    forClinics: {
      enabled: bool(o.forClinics?.enabled, d.forClinics.enabled),
      title: str(o.forClinics?.title, d.forClinics.title),
      body: str(o.forClinics?.body, d.forClinics.body),
      ctaLabel: str(o.forClinics?.ctaLabel, d.forClinics.ctaLabel),
      ctaHref: str(o.forClinics?.ctaHref, d.forClinics.ctaHref),
    },
    faq: {
      enabled: bool(o.faq?.enabled, d.faq.enabled),
      heading: str(o.faq?.heading, d.faq.heading),
      moreLabel: str(o.faq?.moreLabel, d.faq.moreLabel),
      moreHref: str(o.faq?.moreHref, d.faq.moreHref),
      emitJsonLd: bool(o.faq?.emitJsonLd, d.faq.emitJsonLd),
      items: list(
        (o.faq?.items as HomepageFaqItem[] | undefined)?.filter(
          (f) => f?.question && f?.answer,
        ),
        d.faq.items,
      ),
    },
    blog: feed(o.blog, d.blog),
    keywords: list(
      (o.keywords as string[] | undefined)?.map((k) => k.trim()).filter(Boolean),
      d.keywords,
    ),
  };
}

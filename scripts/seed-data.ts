/**
 * Seed data — Stage 1.11. Pure data (no DB/model imports). Cross-references use
 * slugs; `scripts/seed.ts` resolves them to ObjectIds at insert time.
 *
 * Taxonomy mirrors PRD §18. Demo clinics/reviews are illustrative only
 * (a sensitive medical vertical — see PRD §14; nothing here implies efficacy).
 */
import type {
  ClinicStatus,
  ClinicTier,
  PlanKey,
  PriceModel,
  ReviewStatus,
  ReviewVerificationMethod,
  TeamSize,
  VerificationBadge,
} from "@/lib/enums";

// ── Seed spec interfaces ────────────────────────────────────────────────────

export interface TaxonomySeed {
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  icon?: string;
  category?: string;
  issuingBody?: string;
  order?: number;
  /** Per-term SEO overrides (persist to `Taxonomy.seo`; win over auto title). */
  seo?: { metaTitle?: string; metaDescription?: string };
}

export interface CountrySeed {
  name: string;
  slug: string;
  countryCode: string;
  flag: string;
  order?: number;
}

export interface CitySeed {
  name: string;
  slug: string;
  countryCode: string;
  country: string;
  region?: string;
  lat: number;
  lng: number;
  parentCountrySlug: string;
}

export interface ClinicLocationSeed {
  citySlug: string;
  isHQ?: boolean;
  addressLine?: string;
  postalCode?: string;
  phone?: string;
}

export interface PersonSeed {
  name: string;
  title?: string;
  credentials?: string;
  bio?: string;
}

export interface CaseStudySeed {
  title: string;
  conditionSlug?: string;
  summary?: string;
  outcome?: string;
  isAnonymized?: boolean;
}

export interface ClinicSeed {
  name: string;
  slug: string;
  status: ClinicStatus;
  tier: ClinicTier;
  isVerified?: boolean;
  badge?: VerificationBadge;
  verificationMethod?: string;
  tagline: string;
  description: string;
  coverImage?: { url: string; alt: string };
  treatmentSlugs: string[];
  conditionSlugs: string[];
  cellSourceSlugs: string[];
  serviceFocus: { treatmentSlug: string; percent: number }[];
  accreditationSlugs: string[];
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  priceModel?: PriceModel;
  priceNote?: string;
  foundedYear?: number;
  teamSize?: TeamSize;
  physiciansCount?: number;
  medicalDirector?: PersonSeed;
  team?: PersonSeed[];
  languages?: string[];
  locations: ClinicLocationSeed[];
  /**
   * Only set this for real clinics with a live site. The profile's tracked
   * "Visit website" button renders whenever this is present, so a placeholder
   * URL ships a button that leads nowhere — fictional demo clinics leave it off.
   */
  website?: string;
  social?: Record<string, string>;
  contactEmail?: string;
  caseStudies?: CaseStudySeed[];
  faqs?: { question: string; answer: string }[];
  highlights?: string[];
}

export interface ReviewSeed {
  clinicSlug: string;
  status: ReviewStatus;
  isVerified?: boolean;
  verificationMethod?: ReviewVerificationMethod;
  reviewer: {
    displayName?: string;
    isAnonymous?: boolean;
    email?: string;
    country?: string;
    ageRange?: string;
  };
  conditionSlug?: string;
  treatmentSlug?: string;
  treatmentDate?: string;
  cost?: { range?: string; currency?: string; isConfidential?: boolean };
  ratingOverall: number;
  ratings: {
    outcome?: number;
    communication?: number;
    facility?: number;
    value?: number;
    refer?: number;
  };
  headline?: string;
  body?: {
    condition?: string;
    whyChosen?: string;
    treatmentDescription?: string;
    outcome?: string;
    experience?: string;
    improvement?: string;
  };
  whyChosenTags?: string[];
  wouldRecommend?: boolean;
  providerResponse?: { body: string };
}

export interface PlanSeed {
  key: PlanKey;
  name: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  features: string[];
  badge?: string;
  highlighted?: boolean;
  ctaLabel?: string;
  order: number;
}

// ── Taxonomy (PRD §18) ──────────────────────────────────────────────────────

export const TREATMENTS: TaxonomySeed[] = [
  {
    name: "Mesenchymal Stem Cell (MSC) Therapy",
    slug: "msc-therapy",
    category: "Cell therapies",
    icon: "Dna",
    shortDescription:
      "Therapies using mesenchymal stem cells from cord, fat, or marrow.",
    order: 1,
    seo: {
      metaTitle: "MSC Stem Cell Treatment",
      metaDescription:
        "Learn how msc stem cell treatment works, where mesenchymal stem cells come from, and compare verified clinics offering MSC therapy.",
    },
  },
  {
    name: "Autologous (own-cell) Therapy",
    slug: "autologous-therapy",
    category: "Cell therapies",
    icon: "RefreshCw",
    shortDescription: "Treatments using a patient's own cells.",
    order: 2,
    seo: {
      metaTitle: "Autologous Therapy",
      metaDescription:
        "Autologous therapy uses cells drawn from your own body, reducing rejection risk. See how it works, typical costs, and which clinics offer it.",
    },
  },
  {
    name: "Allogeneic (donor) Therapy",
    slug: "allogeneic-therapy",
    category: "Cell therapies",
    icon: "Users",
    shortDescription: "Treatments using screened donor cells.",
    order: 3,
  },
  {
    name: "Adipose-Derived Stem Cell Therapy",
    slug: "adipose-derived-therapy",
    category: "Cell therapies",
    icon: "Layers",
    shortDescription: "Cells harvested from adipose (fat) tissue.",
    order: 4,
  },
  {
    name: "Bone-Marrow-Derived Therapy",
    slug: "bone-marrow-derived-therapy",
    category: "Cell therapies",
    icon: "Bone",
    shortDescription: "Cells concentrated from bone marrow aspirate.",
    order: 5,
    seo: {
      metaTitle: "Bone-Marrow-Derived Therapy",
      metaDescription:
        "Bone-marrow-derived therapy extracts stem cells from your marrow for regenerative treatment. Compare clinics, procedure steps, and typical costs.",
    },
  },
  {
    name: "Umbilical Cord / Cord-Blood Therapy",
    slug: "cord-blood-therapy",
    category: "Cell therapies",
    icon: "Baby",
    shortDescription: "Cells sourced from umbilical cord tissue or cord blood.",
    order: 6,
    seo: {
      metaTitle: "Umbilical Cord Therapy",
      metaDescription:
        "Umbilical cord therapy uses donor cells from cord tissue, screened before use. See how it differs from autologous options and compare clinics.",
    },
  },
  {
    name: "Exosome Therapy",
    slug: "exosome-therapy",
    category: "Biologics",
    icon: "Sparkles",
    shortDescription: "Cell-derived signalling vesicles used as a biologic.",
    order: 7,
  },
  {
    name: "Platelet-Rich Plasma (PRP)",
    slug: "prp",
    category: "Biologics",
    icon: "Droplet",
    shortDescription: "Concentrated platelets from a patient's own blood.",
    order: 8,
  },
  {
    name: "Stromal Vascular Fraction (SVF)",
    slug: "svf",
    category: "Biologics",
    icon: "FlaskConical",
    shortDescription: "Cell fraction isolated from adipose tissue.",
    order: 9,
  },
  {
    name: "Stem Cell Banking / Storage",
    slug: "stem-cell-banking",
    category: "Services",
    icon: "Archive",
    shortDescription: "Collection and cryostorage of cells for future use.",
    order: 10,
  },
  {
    name: "Regenerative Orthopedics",
    slug: "regenerative-orthopedics",
    category: "Specialties",
    icon: "Activity",
    shortDescription:
      "Image-guided regenerative injections for joints and soft tissue.",
    order: 11,
  },
  {
    name: "IV / Systemic Cell Therapy",
    slug: "iv-systemic-therapy",
    category: "Delivery",
    icon: "Syringe",
    shortDescription: "Intravenous or systemic delivery protocols.",
    order: 12,
  },
];

export const CONDITIONS: TaxonomySeed[] = [
  // Orthopedic / Musculoskeletal
  {
    name: "Knee Osteoarthritis",
    slug: "knee-osteoarthritis",
    category: "Orthopedic/Musculoskeletal",
    order: 1,
    seo: {
      metaTitle: "Stem Cell Therapy Knee Arthritis",
      metaDescription:
        "Compare clinics offering stem cell therapy for knee arthritis and other stem cell therapy for knees options, with verified reviews and pricing.",
    },
  },
  {
    name: "Hip Osteoarthritis",
    slug: "hip-osteoarthritis",
    category: "Orthopedic/Musculoskeletal",
    order: 2,
  },
  {
    name: "Rotator Cuff / Shoulder",
    slug: "rotator-cuff-shoulder",
    category: "Orthopedic/Musculoskeletal",
    order: 3,
  },
  {
    name: "Back & Spine",
    slug: "back-and-spine",
    category: "Orthopedic/Musculoskeletal",
    order: 4,
  },
  {
    name: "Sports Injuries",
    slug: "sports-injuries",
    category: "Orthopedic/Musculoskeletal",
    order: 5,
  },
  {
    name: "Joint Pain",
    slug: "joint-pain",
    category: "Orthopedic/Musculoskeletal",
    order: 6,
    seo: {
      metaTitle: "Stem Cell Therapy Joint Pain",
      metaDescription:
        "See how stem cell therapy for joint pain works, which joints it treats, and compare verified clinics offering regenerative options for joint pain.",
    },
  },
  // Autoimmune / Inflammatory
  {
    name: "Rheumatoid Arthritis",
    slug: "rheumatoid-arthritis",
    category: "Autoimmune/Inflammatory",
    order: 7,
  },
  {
    name: "Lupus",
    slug: "lupus",
    category: "Autoimmune/Inflammatory",
    order: 8,
  },
  {
    name: "Multiple Sclerosis",
    slug: "multiple-sclerosis",
    category: "Autoimmune/Inflammatory",
    order: 9,
  },
  {
    name: "Crohn's / IBD",
    slug: "crohns-ibd",
    category: "Autoimmune/Inflammatory",
    order: 10,
  },
  // Neurological
  {
    name: "Parkinson's",
    slug: "parkinsons",
    category: "Neurological",
    order: 11,
  },
  {
    name: "Neuropathy",
    slug: "neuropathy",
    category: "Neurological",
    order: 12,
  },
  {
    name: "Stroke Recovery",
    slug: "stroke-recovery",
    category: "Neurological",
    order: 13,
  },
  {
    name: "Spinal Cord Injury",
    slug: "spinal-cord-injury",
    category: "Neurological",
    order: 14,
  },
  {
    name: "Autism (supportive)",
    slug: "autism-supportive",
    category: "Neurological",
    order: 15,
  },
  // Other
  {
    name: "Anti-Aging / Longevity",
    slug: "anti-aging-longevity",
    category: "Other",
    order: 16,
  },
  {
    name: "Hair Restoration",
    slug: "hair-restoration",
    category: "Other",
    order: 17,
  },
  {
    name: "Skin / Aesthetic",
    slug: "skin-aesthetic",
    category: "Other",
    order: 18,
  },
  {
    name: "Cardiovascular",
    slug: "cardiovascular",
    category: "Other",
    order: 19,
  },
  {
    name: "Diabetes (supportive)",
    slug: "diabetes-supportive",
    category: "Other",
    order: 20,
  },
  {
    name: "Erectile / Sexual Health",
    slug: "sexual-health",
    category: "Other",
    order: 21,
  },
  {
    name: "COPD / Pulmonary",
    slug: "copd-pulmonary",
    category: "Other",
    order: 22,
  },
  {
    name: "Post-COVID recovery",
    slug: "post-covid-recovery",
    category: "Other",
    order: 23,
  },
];

export const CELL_SOURCES: TaxonomySeed[] = [
  {
    name: "Autologous",
    slug: "autologous",
    shortDescription: "From the patient's own body.",
    order: 1,
  },
  {
    name: "Allogeneic",
    slug: "allogeneic",
    shortDescription: "From a screened donor.",
    order: 2,
  },
  {
    name: "Umbilical Cord",
    slug: "umbilical-cord",
    shortDescription: "From donated umbilical cord tissue.",
    order: 3,
  },
  {
    name: "Cord Blood",
    slug: "cord-blood",
    shortDescription: "From donated cord blood.",
    order: 4,
  },
  {
    name: "Adipose (fat)",
    slug: "adipose",
    shortDescription: "From adipose (fat) tissue.",
    order: 5,
  },
  {
    name: "Bone Marrow",
    slug: "bone-marrow",
    shortDescription: "From bone marrow aspirate.",
    order: 6,
  },
  {
    name: "Placental / Wharton's Jelly",
    slug: "placental-whartons-jelly",
    shortDescription: "From placental or Wharton's jelly tissue.",
    order: 7,
  },
  {
    name: "Exosomes",
    slug: "exosomes",
    shortDescription: "Cell-derived signalling vesicles.",
    order: 8,
  },
];

export const ACCREDITATIONS: TaxonomySeed[] = [
  {
    name: "GMP-Certified Lab",
    slug: "gmp-certified-lab",
    issuingBody: "Good Manufacturing Practice",
    shortDescription: "Lab follows Good Manufacturing Practice standards.",
    order: 1,
  },
  {
    name: "ISO 9001",
    slug: "iso-9001",
    issuingBody: "International Organization for Standardization",
    shortDescription: "Quality management certification.",
    order: 2,
  },
  {
    name: "ISO 13485",
    slug: "iso-13485",
    issuingBody: "International Organization for Standardization",
    shortDescription: "Medical device quality certification.",
    order: 3,
  },
  {
    name: "Local Health-Authority Registration",
    slug: "health-authority-registration",
    shortDescription: "Registered with the local health authority.",
    order: 4,
  },
  {
    name: "Hospital Affiliation",
    slug: "hospital-affiliation",
    shortDescription: "Affiliated with an accredited hospital.",
    order: 5,
  },
  {
    name: "Board-Certified Physicians",
    slug: "board-certified-physicians",
    shortDescription: "Care led by board-certified physicians.",
    order: 6,
  },
  {
    name: "Research / Clinical-Trial Participation",
    slug: "clinical-trial-participation",
    shortDescription: "Participates in registered research or clinical trials.",
    order: 7,
  },
];

export const COUNTRIES: CountrySeed[] = [
  { name: "Mexico", slug: "mexico", countryCode: "MX", flag: "🇲🇽", order: 1 },
  { name: "Panama", slug: "panama", countryCode: "PA", flag: "🇵🇦", order: 2 },
  {
    name: "Colombia",
    slug: "colombia",
    countryCode: "CO",
    flag: "🇨🇴",
    order: 3,
  },
  {
    name: "Thailand",
    slug: "thailand",
    countryCode: "TH",
    flag: "🇹🇭",
    order: 4,
  },
  { name: "India", slug: "india", countryCode: "IN", flag: "🇮🇳", order: 5 },
  { name: "Turkey", slug: "turkey", countryCode: "TR", flag: "🇹🇷", order: 6 },
  {
    name: "United Arab Emirates",
    slug: "uae",
    countryCode: "AE",
    flag: "🇦🇪",
    order: 7,
  },
  {
    name: "United States",
    slug: "usa",
    countryCode: "US",
    flag: "🇺🇸",
    order: 8,
  },
  {
    name: "Cayman Islands",
    slug: "cayman-islands",
    countryCode: "KY",
    flag: "🇰🇾",
    order: 9,
  },
  { name: "Japan", slug: "japan", countryCode: "JP", flag: "🇯🇵", order: 10 },
  {
    name: "South Korea",
    slug: "south-korea",
    countryCode: "KR",
    flag: "🇰🇷",
    order: 11,
  },
];

export const CITIES: CitySeed[] = [
  {
    name: "Cancún",
    slug: "cancun",
    countryCode: "MX",
    country: "Mexico",
    region: "Quintana Roo",
    lat: 21.1619,
    lng: -86.8515,
    parentCountrySlug: "mexico",
  },
  {
    name: "Tijuana",
    slug: "tijuana",
    countryCode: "MX",
    country: "Mexico",
    region: "Baja California",
    lat: 32.5149,
    lng: -117.0382,
    parentCountrySlug: "mexico",
  },
  {
    name: "Mexico City",
    slug: "mexico-city",
    countryCode: "MX",
    country: "Mexico",
    region: "CDMX",
    lat: 19.4326,
    lng: -99.1332,
    parentCountrySlug: "mexico",
  },
  {
    name: "Panama City",
    slug: "panama-city",
    countryCode: "PA",
    country: "Panama",
    region: "Panamá",
    lat: 8.9824,
    lng: -79.5199,
    parentCountrySlug: "panama",
  },
  {
    name: "Bogotá",
    slug: "bogota",
    countryCode: "CO",
    country: "Colombia",
    region: "Cundinamarca",
    lat: 4.711,
    lng: -74.0721,
    parentCountrySlug: "colombia",
  },
  {
    name: "Bangkok",
    slug: "bangkok",
    countryCode: "TH",
    country: "Thailand",
    region: "Bangkok",
    lat: 13.7563,
    lng: 100.5018,
    parentCountrySlug: "thailand",
  },
  {
    name: "Dubai",
    slug: "dubai",
    countryCode: "AE",
    country: "United Arab Emirates",
    region: "Dubai",
    lat: 25.2048,
    lng: 55.2708,
    parentCountrySlug: "uae",
  },
  {
    name: "Grand Cayman",
    slug: "grand-cayman",
    countryCode: "KY",
    country: "Cayman Islands",
    region: "George Town",
    lat: 19.3133,
    lng: -81.2546,
    parentCountrySlug: "cayman-islands",
  },
  {
    name: "Tokyo",
    slug: "tokyo",
    countryCode: "JP",
    country: "Japan",
    region: "Tokyo",
    lat: 35.6762,
    lng: 139.6503,
    parentCountrySlug: "japan",
  },
  {
    name: "Dallas",
    slug: "dallas",
    countryCode: "US",
    country: "United States",
    region: "Texas",
    lat: 32.7767,
    lng: -96.797,
    parentCountrySlug: "usa",
  },
];

// ── Clinics ─────────────────────────────────────────────────────────────────

export const CLINICS: ClinicSeed[] = [
  {
    // Real US clinic (Dallas, TX) — sourced from the clinic's own website,
    // July 2026. Copy is neutral/non-promotional per the YMYL content rules;
    // ratings/reviews are left to the recompute pipeline (none fabricated).
    name: "Innovations Stem Cell Center",
    slug: "innovations-stem-cell-center",
    status: "published",
    tier: "verified",
    isVerified: true,
    badge: "verified",
    verificationMethod: "Clinic website & public business records (July 2026)",
    tagline: "Adipose-derived stem cell therapy for longevity in Dallas",
    description:
      "Innovations Stem Cell Center has run adipose-derived stem cell therapy in Dallas since 2005. The cells come from the patient's own fat, so no donor or cord cells are involved, and they're processed in the clinic's own lab rather than shipped out. Founder Dr. Bill Johnson built the center's longevity protocol around those cells, aimed at chronic inflammation, tissue repair, and cellular and mitochondrial health. The clinic is careful about what it claims: it frames the work as supporting healthspan, not extending lifespan, and states plainly that stem cell therapy for anti-aging is not FDA-approved and is still investigational.",
    treatmentSlugs: ["adipose-derived-therapy", "msc-therapy"],
    conditionSlugs: ["anti-aging-longevity", "joint-pain"],
    cellSourceSlugs: ["adipose", "autologous"],
    serviceFocus: [
      { treatmentSlug: "adipose-derived-therapy", percent: 60 },
      { treatmentSlug: "msc-therapy", percent: 40 },
    ],
    accreditationSlugs: [],
    currency: "USD",
    priceModel: "consult_to_quote",
    priceNote: "Pricing depends on the protocol and is quoted after a consultation.",
    foundedYear: 2005,
    medicalDirector: {
      name: "Dr. Bill Johnson",
      title: "Founder & Medical Director",
      credentials: "MD",
      bio: "Has performed stem cell procedures for over 13 years and was an early adopter of adipose-derived therapy.",
    },
    languages: ["English"],
    locations: [
      {
        citySlug: "dallas",
        isHQ: true,
        addressLine: "12660 Coit Road",
        postalCode: "75251",
        phone: "(972) 893-9849",
      },
    ],
    website: "https://innovationsstemcellcenter.com",
    faqs: [
      {
        question: "What kind of stem cells does the clinic use?",
        answer:
          "Your own. They're mesenchymal stem cells drawn from your fat tissue and processed on-site, so no donor or umbilical-cord cells are involved.",
      },
      {
        question: "Is stem cell therapy for anti-aging FDA-approved?",
        answer:
          "No. The clinic states that stem cell therapy for anti-aging and longevity isn't FDA-approved and is still considered investigational. Results vary from person to person.",
      },
      {
        question: "Where is the clinic, and how long has it been running?",
        answer:
          "Dallas, Texas, at 12660 Coit Road. It has been doing adipose-derived stem cell work since 2005.",
      },
    ],
    highlights: [
      "Running since 2005",
      "Uses your own fat-derived cells",
      "Processes cells in its own lab",
      "Dallas, Texas",
    ],
  },
];

// ── Reviews ─────────────────────────────────────────────────────────────────

/**
 * No seeded reviews. A review is patient testimony about a named clinic, so a
 * fabricated one is a fabricated account of real medical care. Reviews have to
 * arrive through the public form and the admin moderation queue, never from a
 * fixture.
 */
export const REVIEWS: ReviewSeed[] = [];

// ── Listing plans (PRD §5.7) ────────────────────────────────────────────────

export const PLANS: PlanSeed[] = [
  {
    key: "basic",
    name: "Basic",
    description: "Get listed in the My Stem Cell Guide directory.",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "USD",
    features: [
      "Public clinic profile",
      "Appear in directory & search",
      "Receive consultation requests",
    ],
    badge: "",
    ctaLabel: "Get listed free",
    order: 1,
  },
  {
    key: "verified",
    name: "Verified",
    description: "Build trust with a verified badge and richer profile.",
    priceMonthly: 149,
    priceYearly: 1490,
    currency: "USD",
    features: [
      "Everything in Basic",
      "Verified badge",
      "Accreditation showcase",
      "Priority in search ranking",
      "Respond to reviews",
    ],
    badge: "Verified",
    highlighted: true,
    ctaLabel: "Become verified",
    order: 2,
  },
  {
    key: "featured",
    name: "Featured",
    description: "Maximize visibility with featured placement.",
    priceMonthly: 399,
    priceYearly: 3990,
    currency: "USD",
    features: [
      "Everything in Verified",
      "Featured placement on directory pages",
      "Homepage feature eligibility",
      "Enhanced analytics",
    ],
    badge: "Featured",
    ctaLabel: "Get featured",
    order: 3,
  },
];

// ── Homepage / settings content ─────────────────────────────────────────────

export const HERO = {
  headline:
    "Find and compare trusted regenerative medicine clinics with My Stem Cell Guide.",
  subhead:
    "Compare accredited stem cell clinics worldwide by treatment, condition, location, pricing, and verified patient reviews to help you make a more informed healthcare decision.",
  ctaPrimaryLabel: "Find a clinic",
  ctaSecondaryLabel: "Browse all clinics",
};

export const POPULAR_SEARCHES = [
  { label: "Knee osteoarthritis", href: "/conditions/knee-osteoarthritis" },
  { label: "MSC therapy", href: "/treatments/msc-therapy" },
  { label: "Anti-aging", href: "/conditions/anti-aging-longevity" },
  { label: "Clinics in Mexico", href: "/locations/mexico" },
  { label: "Exosome therapy", href: "/treatments/exosome-therapy" },
];

export const TESTIMONIALS = [
  {
    quote:
      "My Stem Cell Guide made it easy to compare clinics and see real reviews before reaching out.",
    author: "James T.",
    role: "Patient",
    location: "United States",
    rating: 5,
  },
  {
    quote:
      "The verification badges and methodology page helped me feel confident in my shortlist.",
    author: "Sofia R.",
    role: "Patient",
    location: "United States",
    rating: 5,
  },
  {
    quote: "Clear pricing ranges saved me hours of back-and-forth emails.",
    author: "Daniel W.",
    role: "Patient",
    location: "Australia",
    rating: 4,
  },
];

/** Slugs of clinics to feature on the homepage (resolved to IDs in seed). */
export const FEATURED_CLINIC_SLUGS: string[] = [];

// ── Editorial content (programmatic-SEO / AEO) ──────────────────────────────
// Demonstration data for the review-gated content pipeline. Everything below is
// seeded as `in_review` — NEVER public, NEVER approved — and carries no real
// reviewer. It exists so a dev DB can exercise the CMS + combination routes.
// The prose is deliberately cautious (no efficacy/cure claims); a real medical
// reviewer must verify and approve before anything goes live (PRD §14).

export interface MedicalReviewerSeed {
  name: string;
  slug: string;
  credentials?: string;
  title?: string;
  bio?: string;
  sameAs?: string[];
  isActive?: boolean;
}

/**
 * A placeholder reviewer — INACTIVE so it never appears in the picker or
 * publicly. Replace it with a real credentialed reviewer in /seoteam/reviewers
 * before approving any content.
 */
export const MEDICAL_REVIEWERS: MedicalReviewerSeed[] = [
  {
    name: "Example Reviewer (replace before publishing)",
    slug: "example-reviewer",
    credentials: "MD",
    title: "Placeholder: add your real medical reviewer",
    bio: "This is a placeholder record. Add a real, credentialed medical reviewer (name, credentials, and authoritative profile links) and mark them active before approving any YMYL content.",
    isActive: false,
  },
];

export interface FaqSeed {
  question: string;
  answer: string;
}
export interface KeyFactSeed {
  label: string;
  value: string;
  sourceUrl?: string;
}

export interface MatrixPageSeed {
  kind: "treatment_condition" | "treatment_country" | "condition_country";
  slugA: string;
  slugB: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  intro?: string;
  body?: string;
  faqs?: FaqSeed[];
  keyFacts?: KeyFactSeed[];
}

/** Sample combination pages (in_review). Cautious, non-promotional framing. */
export const MATRIX_PAGES: MatrixPageSeed[] = [
  {
    kind: "treatment_condition",
    slugA: "msc-therapy",
    slugB: "knee-osteoarthritis",
    title: "MSC therapy for knee osteoarthritis: what to know",
    metaTitle:
      "MSC Therapy for Knee Osteoarthritis | Evidence and Considerations",
    metaDescription:
      "What mesenchymal stem cell (MSC) therapy is, how it's studied for knee osteoarthritis, and questions to ask before considering it. Informational only.",
    intro:
      "Mesenchymal stem cell (MSC) therapy is being studied as an investigational option for knee osteoarthritis. Current clinical evidence is still emerging and mixed, and it is not an established standard of care. Potential benefits, risks, and costs vary by person and clinic, so discuss any option with a qualified specialist first.",
    body: "<h2>What MSC therapy is</h2><p>Mesenchymal stem cells are cells that can be sourced from tissues such as bone marrow or adipose (fat). In a regenerative-medicine setting they are prepared and delivered to a target area, and for the knee that usually means an injection. How a given clinic prepares and delivers cells varies, which makes protocols hard to compare directly.</p><h2>How it's studied for knee osteoarthritis</h2><p>Knee osteoarthritis is a common, progressive joint condition. Researchers are investigating whether MSC-based approaches can help with symptoms such as pain and function. Study designs, cell sources, doses, and follow-up periods differ widely, so results are not directly comparable and should be read with caution.</p><h2>What the evidence shows so far</h2><p>Published research is best described as emerging and mixed. Some early trials report changes in reported symptoms; others are small, short, or lack long-term data. This is not the same as proof of effectiveness, and outcomes reported in one study may not generalize. No responsible source can promise a specific result.</p><h2>How it compares to standard care</h2><p>Conventional management of knee osteoarthritis typically starts with conservative measures (for example, exercise, weight management, and physician-directed medication) and may progress to surgical options in advanced cases. MSC therapy is not a replacement for that pathway and is generally considered investigational.</p><h2>Questions to ask a clinic</h2><ul><li>Is this treatment offered as part of a registered clinical trial, and what is its regulatory status where I live?</li><li>What cell source, preparation, and dose is used, and what evidence supports it for knee osteoarthritis specifically?</li><li>What are the known risks, and what does follow-up and aftercare involve?</li><li>What is the full cost, and what is and isn't included?</li></ul>",
    faqs: [
      {
        question:
          "Is MSC therapy an approved treatment for knee osteoarthritis?",
        answer:
          "In most countries MSC therapy for knee osteoarthritis is considered investigational rather than an approved standard treatment. Regulatory status varies by jurisdiction, so confirm the local status and whether a treatment is offered within a registered trial.",
      },
      {
        question: "Does MSC therapy cure knee osteoarthritis?",
        answer:
          "No. Osteoarthritis is a progressive condition and no cure is established. MSC therapy is studied as a possible way to help with symptoms for some people, but outcomes vary and are not guaranteed.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Costs vary widely by clinic, country, cell source, and number of sessions. Ask each clinic for a full, itemized quote and confirm what follow-up is included before committing.",
      },
      {
        question: "What are the risks?",
        answer:
          "As with any injection-based procedure there are potential risks, and because protocols differ, risks can vary between providers. Discuss the specific risks and aftercare with a qualified physician who knows your medical history.",
      },
    ],
    keyFacts: [
      {
        label: "Regulatory status",
        value:
          "Generally investigational for knee osteoarthritis; varies by country. Verify locally.",
      },
      {
        label: "Evidence maturity",
        value:
          "Emerging and mixed: small/short studies; long-term data limited.",
      },
      {
        label: "Standard of care",
        value:
          "Conservative management first (exercise, weight management, physician-directed care).",
      },
    ],
  },
];

export interface TaxonomyEditorialSeed {
  kind: "treatment" | "condition" | "location";
  slug: string;
  body?: string;
  faqs?: FaqSeed[];
  keyFacts?: KeyFactSeed[];
  // Treatment-only structured fields
  mechanism?: string;
  evidenceLevel?: "preclinical" | "early-clinical" | "mixed" | "established";
  evidenceSummary?: string;
  costRange?: string;
  recoveryTimeline?: string;
  risks?: string;
}

/** Sample taxonomy enrichment (in_review). Cautious framing only. */
export const TAXONOMY_EDITORIAL: TaxonomyEditorialSeed[] = [
  {
    kind: "treatment",
    slug: "msc-therapy",
    body: "Mesenchymal stem cell (MSC) therapy is a regenerative-medicine approach studied across a range of conditions. The sections below summarize how it is described in general terms; they are informational only and not medical advice.",
    mechanism:
      "MSCs are cells that can be isolated from tissues such as bone marrow or adipose (fat). In practice, a clinic collects or sources cells, prepares them, and delivers them to a target area, often by injection. Exact preparation and delivery methods vary between providers.",
    evidenceLevel: "mixed",
    evidenceSummary:
      "Clinical research is active but uneven: studies differ in cell source, dose, and follow-up, and many are small or short. Findings should be read as emerging rather than settled, and results in one setting may not generalize.",
    costRange:
      "Pricing varies widely by clinic, country, cell source, and number of sessions. Always request a full, itemized quote and confirm what aftercare is included.",
    recoveryTimeline:
      "Aftercare and recovery expectations differ by protocol and the area treated. Ask the treating clinic what follow-up looks like and who to contact with concerns.",
    risks:
      "As with any injection-based procedure, there are potential risks that vary by protocol. Discuss specific risks, contraindications, and aftercare with a qualified physician familiar with your history.",
    faqs: [
      {
        question: "Is MSC therapy approved?",
        answer:
          "Regulatory status depends on the country and the specific use. In many places it is considered investigational. Confirm the local status and whether a treatment is offered within a registered clinical trial.",
      },
      {
        question: "Is MSC therapy guaranteed to work?",
        answer:
          "No. No responsible provider can guarantee a result. Outcomes vary between people and protocols, and evidence is still emerging for many uses.",
      },
    ],
    keyFacts: [
      {
        label: "Common cell sources",
        value:
          "Bone marrow, adipose (fat), and others depending on the clinic.",
      },
      {
        label: "Evidence maturity",
        value: "Varies by use; often emerging rather than established.",
      },
    ],
  },
];

// ── Topical-authority pillar guides (blog) ──────────────────────────────────
// Seeded as `draft` (never public). Deliberately procedural/cautious — they
// help a reader research the space without making efficacy claims. Publish only
// after human editorial review.

export interface BlogPostSeed {
  title: string;
  slug: string;
  template:
    "how-to" | "listicle" | "comparison" | "review" | "news" | "generic";
  excerpt?: string;
  metaTitle?: string;
  author?: string;
  body: string;
}

export const BLOG_POSTS: BlogPostSeed[] = [
  {
    title: "How to vet a stem cell clinic: a practical checklist",
    slug: "how-to-vet-a-stem-cell-clinic",
    template: "how-to",
    author: "Stem Cell Guide Team",
    excerpt:
      "A practical, non-medical checklist for researching a regenerative-medicine clinic: regulatory status, protocol transparency, accreditations, costs, and red flags.",
    metaTitle: "How to Vet a Stem Cell Clinic | A Practical Checklist",
    body: "<p>Choosing a clinic in a fast-moving, unevenly-regulated field is hard. This checklist is about <em>process</em>, not medical advice: it helps you ask better questions. Always make treatment decisions with a qualified physician who knows your history.</p><h2>1. Check regulatory and trial status</h2><p>Ask whether the specific treatment is approved where it's offered, or whether it's investigational. If it's described as part of research, ask whether it's a registered clinical trial and where it's registered. Regulatory status varies widely by country.</p><h2>2. Ask about the specific protocol</h2><p>Vague marketing is a warning sign. A transparent clinic can explain the cell source, how cells are prepared, the dose, the delivery method, and the evidence they rely on for your specific condition.</p><h2>3. Verify accreditations and the medical team</h2><p>Look for named, credentialed physicians and independently verifiable accreditations. Confirm who performs the procedure and what their qualifications are.</p><h2>4. Understand costs and what's included</h2><p>Request a full, itemized quote: the procedure, follow-up, aftercare, and any travel-related costs. Be wary of pressure to pay quickly or commit to packages before your questions are answered.</p><h2>5. Weigh the risks and aftercare</h2><p>Every procedure carries risk. Ask what the known risks are, how complications are handled, and what follow-up looks like once you return home.</p><h2>Red flags</h2><ul><li>Guarantees of a cure or a specific outcome.</li><li>Reluctance to explain the protocol or share the evidence.</li><li>No named, credentialed medical team.</li><li>Pressure to decide or pay quickly.</li></ul><p>If something feels off, it's reasonable to walk away and seek a second opinion.</p>",
  },
  {
    title: "Stem cell therapy safety and regulation: what to understand",
    slug: "stem-cell-therapy-safety-and-regulation",
    template: "generic",
    author: "Stem Cell Guide Team",
    excerpt:
      "Why regulation varies by country, what 'investigational' vs 'approved' means, and how to check the regulatory status of a treatment. Informational only.",
    metaTitle: "Stem Cell Therapy Safety and Regulation | What to Understand",
    body: "<p>Regenerative medicine spans a wide range of treatments, and the rules that govern them differ from country to country. This overview is informational and does not recommend or endorse any treatment.</p><h2>Why regulation varies</h2><p>Different jurisdictions classify and regulate cell-based treatments differently. A treatment that is tightly restricted in one country may be marketed more freely in another. That variation is one reason patients travel, and one reason careful research matters.</p><h2>'Investigational' vs 'approved'</h2><p>An <strong>approved</strong> treatment has cleared a regulator's bar for a specific use. An <strong>investigational</strong> treatment is still being studied and has not. Many cell-based offerings are investigational for many uses; a clinic should be clear about which applies to you.</p><h2>Questions worth asking about safety</h2><ul><li>What are the known risks of this specific procedure?</li><li>How are potential complications managed, and by whom?</li><li>What does follow-up and aftercare involve?</li></ul><h2>The role of clinical trials</h2><p>Registered clinical trials are how treatments build evidence and, eventually, regulatory approval. If a treatment is offered as research, ask where the trial is registered and what it involves.</p><h2>Where to check</h2><p>Regulatory status is best confirmed with the relevant national regulator and, for trials, with public trial registries. When in doubt, discuss the specifics with a qualified physician before making any decision.</p>",
  },
];

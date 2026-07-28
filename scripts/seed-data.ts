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

// ── Demo clinics ────────────────────────────────────────────────────────────

export const CLINICS: ClinicSeed[] = [
  {
    name: "Renova Cell Institute",
    slug: "renova-cell-institute",
    status: "published",
    tier: "featured",
    isVerified: true,
    badge: "premier",
    verificationMethod: "Accreditation records + verified reviews",
    tagline: "Personalized regenerative protocols on the Riviera Maya",
    description:
      "Renova Cell Institute is a regenerative-medicine center in Cancún offering mesenchymal stem cell, exosome, and PRP protocols for orthopedic and autoimmune conditions. Care is led by board-certified physicians and supported by an on-site GMP-certified laboratory.",
    coverImage: {
      url: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&q=80",
      alt: "Modern clinic reception",
    },
    treatmentSlugs: [
      "msc-therapy",
      "exosome-therapy",
      "prp",
      "iv-systemic-therapy",
    ],
    conditionSlugs: [
      "knee-osteoarthritis",
      "rheumatoid-arthritis",
      "anti-aging-longevity",
      "joint-pain",
    ],
    cellSourceSlugs: ["umbilical-cord", "exosomes", "autologous"],
    serviceFocus: [
      { treatmentSlug: "msc-therapy", percent: 55 },
      { treatmentSlug: "exosome-therapy", percent: 25 },
      { treatmentSlug: "prp", percent: 20 },
    ],
    accreditationSlugs: [
      "gmp-certified-lab",
      "iso-9001",
      "board-certified-physicians",
      "health-authority-registration",
    ],
    priceMin: 6500,
    priceMax: 18000,
    currency: "USD",
    priceModel: "package",
    priceNote:
      "Final pricing depends on protocol and cell count; quoted after consultation.",
    foundedYear: 2015,
    teamSize: "51-200",
    physiciansCount: 8,
    medicalDirector: {
      name: "Dr. Mariana López",
      title: "Medical Director",
      credentials: "MD, Regenerative Medicine",
      bio: "Board-certified physician with 15+ years in regenerative orthopedics.",
    },
    team: [
      { name: "Dr. Carlos Méndez", title: "Lead Physician", credentials: "MD" },
      {
        name: "Dr. Ana Ruiz",
        title: "Laboratory Director",
        credentials: "PhD, Cell Biology",
      },
    ],
    languages: ["English", "Spanish"],
    locations: [
      {
        citySlug: "cancun",
        isHQ: true,
        addressLine: "Av. Bonampak 220, Zona Hotelera",
        postalCode: "77500",
        phone: "+52 998 555 0140",
      },
    ],
    social: {
      instagram: "https://instagram.com/renovacell",
      linkedin: "https://linkedin.com/company/renovacell",
    },
    contactEmail: "info@renova.example",
    caseStudies: [
      {
        title: "Bilateral knee osteoarthritis",
        conditionSlug: "knee-osteoarthritis",
        summary:
          "A 62-year-old patient with moderate knee osteoarthritis received an MSC protocol.",
        outcome:
          "Patient reported reduced pain and improved mobility at 6 months. Individual results vary and are not guaranteed.",
        isAnonymized: true,
      },
    ],
    faqs: [
      {
        question: "Do you offer a free consultation?",
        answer:
          "Yes. An initial consultation reviews your history and goals before any protocol is proposed.",
      },
      {
        question: "Where are the cells processed?",
        answer:
          "All cells are processed in our on-site GMP-certified laboratory.",
      },
    ],
    highlights: [
      "On-site GMP-certified lab",
      "Board-certified physicians",
      "English & Spanish support",
      "Airport pickup for medical travelers",
    ],
  },
  {
    name: "Vitalis Regenerative",
    slug: "vitalis-regenerative",
    status: "published",
    tier: "verified",
    isVerified: true,
    badge: "verified",
    verificationMethod: "Accreditation records",
    tagline: "Cord-derived cell therapy in the heart of Panama City",
    description:
      "Vitalis Regenerative provides umbilical-cord MSC and cord-blood protocols for orthopedic and longevity goals, with an emphasis on transparent pricing and aftercare for international patients.",
    treatmentSlugs: [
      "msc-therapy",
      "cord-blood-therapy",
      "iv-systemic-therapy",
    ],
    conditionSlugs: [
      "hip-osteoarthritis",
      "anti-aging-longevity",
      "neuropathy",
    ],
    cellSourceSlugs: ["umbilical-cord", "cord-blood"],
    serviceFocus: [
      { treatmentSlug: "msc-therapy", percent: 60 },
      { treatmentSlug: "cord-blood-therapy", percent: 40 },
    ],
    accreditationSlugs: [
      "iso-9001",
      "board-certified-physicians",
      "hospital-affiliation",
    ],
    priceMin: 5000,
    priceMax: 14000,
    currency: "USD",
    priceModel: "package",
    foundedYear: 2017,
    teamSize: "11-50",
    physiciansCount: 5,
    medicalDirector: {
      name: "Dr. Roberto Salas",
      title: "Medical Director",
      credentials: "MD",
    },
    languages: ["English", "Spanish"],
    locations: [
      {
        citySlug: "panama-city",
        isHQ: true,
        addressLine: "Calle 50, Obarrio",
        phone: "+507 555 0177",
      },
    ],
    contactEmail: "hello@vitalis.example",
    highlights: [
      "Transparent package pricing",
      "Hospital-affiliated",
      "Aftercare follow-ups",
    ],
  },
  {
    name: "NovaStem Bangkok",
    slug: "novastem-bangkok",
    status: "published",
    tier: "verified",
    isVerified: true,
    badge: "verified",
    verificationMethod: "Accreditation records",
    tagline: "Adipose-derived and exosome protocols in Bangkok",
    description:
      "NovaStem Bangkok focuses on adipose-derived cell therapy, stromal vascular fraction, and exosome protocols, serving regional and international patients seeking regenerative orthopedic and aesthetic care.",
    coverImage: {
      url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80",
      alt: "Clinical treatment room",
    },
    treatmentSlugs: [
      "adipose-derived-therapy",
      "svf",
      "exosome-therapy",
      "regenerative-orthopedics",
    ],
    conditionSlugs: [
      "sports-injuries",
      "skin-aesthetic",
      "joint-pain",
      "sexual-health",
    ],
    cellSourceSlugs: ["adipose", "exosomes"],
    serviceFocus: [
      { treatmentSlug: "adipose-derived-therapy", percent: 45 },
      { treatmentSlug: "svf", percent: 30 },
      { treatmentSlug: "exosome-therapy", percent: 25 },
    ],
    accreditationSlugs: [
      "gmp-certified-lab",
      "iso-13485",
      "health-authority-registration",
    ],
    priceMin: 4000,
    priceMax: 12000,
    currency: "USD",
    priceModel: "per_treatment",
    foundedYear: 2018,
    teamSize: "11-50",
    physiciansCount: 6,
    languages: ["English", "Thai"],
    locations: [
      {
        citySlug: "bangkok",
        isHQ: true,
        addressLine: "Sukhumvit Rd, Watthana",
        phone: "+66 2 555 0199",
      },
    ],
    contactEmail: "care@novastem.example",
    faqs: [
      {
        question: "Do you support medical travel?",
        answer:
          "Yes. We coordinate scheduling and provide documentation for international patients.",
      },
    ],
    highlights: [
      "GMP-certified lab",
      "English & Thai support",
      "Regenerative orthopedics focus",
    ],
  },
  {
    name: "Cayman Regenerative Center",
    slug: "cayman-regenerative-center",
    status: "published",
    tier: "basic",
    isVerified: false,
    tagline: "Allogeneic cell protocols in the Cayman Islands",
    description:
      "Cayman Regenerative Center offers allogeneic and cord-blood protocols within a regulated jurisdiction, with a focus on neurological and longevity applications.",
    treatmentSlugs: [
      "allogeneic-therapy",
      "cord-blood-therapy",
      "iv-systemic-therapy",
    ],
    conditionSlugs: [
      "multiple-sclerosis",
      "stroke-recovery",
      "anti-aging-longevity",
    ],
    cellSourceSlugs: ["allogeneic", "cord-blood"],
    serviceFocus: [
      { treatmentSlug: "allogeneic-therapy", percent: 70 },
      { treatmentSlug: "cord-blood-therapy", percent: 30 },
    ],
    accreditationSlugs: [
      "health-authority-registration",
      "board-certified-physicians",
    ],
    priceMin: 12000,
    priceMax: 35000,
    currency: "USD",
    priceModel: "package",
    priceNote: "Premium jurisdiction pricing; consult to quote.",
    foundedYear: 2019,
    teamSize: "1-10",
    physiciansCount: 3,
    languages: ["English"],
    locations: [
      {
        citySlug: "grand-cayman",
        isHQ: true,
        addressLine: "George Town",
        phone: "+1 345 555 0123",
      },
    ],
    contactEmail: "info@caymanregen.example",
    highlights: ["Regulated jurisdiction", "Neurological focus"],
  },
  {
    name: "BioRestore Bogotá",
    slug: "biorestore-bogota",
    status: "published",
    tier: "basic",
    isVerified: false,
    tagline: "Autologous PRP and bone-marrow protocols in Bogotá",
    description:
      "BioRestore Bogotá provides autologous PRP and bone-marrow-derived protocols for sports and orthopedic recovery at accessible price points.",
    treatmentSlugs: [
      "prp",
      "bone-marrow-derived-therapy",
      "regenerative-orthopedics",
    ],
    conditionSlugs: ["sports-injuries", "joint-pain", "back-and-spine"],
    cellSourceSlugs: ["autologous", "bone-marrow"],
    serviceFocus: [
      { treatmentSlug: "prp", percent: 50 },
      { treatmentSlug: "bone-marrow-derived-therapy", percent: 50 },
    ],
    accreditationSlugs: ["board-certified-physicians"],
    priceMin: 1200,
    priceMax: 6000,
    currency: "USD",
    priceModel: "per_session",
    foundedYear: 2020,
    teamSize: "1-10",
    physiciansCount: 2,
    languages: ["Spanish", "English"],
    locations: [
      {
        citySlug: "bogota",
        isHQ: true,
        addressLine: "Zona T, Chapinero",
        phone: "+57 1 555 0166",
      },
    ],
    contactEmail: "contacto@biorestore.example",
    highlights: ["Accessible pricing", "Sports-injury focus"],
  },
  {
    name: "Helix Stem Tokyo",
    slug: "helix-stem-tokyo",
    // Pending moderation — demonstrates the admin clinic queue (not public yet).
    status: "pending",
    tier: "basic",
    isVerified: false,
    tagline: "MSC and exosome longevity protocols in Tokyo",
    description:
      "Helix Stem Tokyo is a longevity-focused clinic offering mesenchymal stem cell and exosome protocols. Profile pending verification review.",
    treatmentSlugs: ["msc-therapy", "exosome-therapy"],
    conditionSlugs: ["anti-aging-longevity", "skin-aesthetic"],
    cellSourceSlugs: ["umbilical-cord", "exosomes"],
    serviceFocus: [
      { treatmentSlug: "msc-therapy", percent: 65 },
      { treatmentSlug: "exosome-therapy", percent: 35 },
    ],
    accreditationSlugs: ["iso-9001"],
    priceMin: 9000,
    priceMax: 25000,
    currency: "USD",
    priceModel: "package",
    foundedYear: 2021,
    teamSize: "11-50",
    physiciansCount: 4,
    languages: ["Japanese", "English"],
    locations: [
      {
        citySlug: "tokyo",
        isHQ: true,
        addressLine: "Minato City",
        phone: "+81 3 5555 0188",
      },
    ],
    contactEmail: "info@helixstem.example",
    highlights: ["Longevity focus", "Japanese & English support"],
  },
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

// ── Demo reviews ────────────────────────────────────────────────────────────

export const REVIEWS: ReviewSeed[] = [
  {
    clinicSlug: "renova-cell-institute",
    status: "approved",
    isVerified: true,
    verificationMethod: "document",
    reviewer: {
      displayName: "James T.",
      country: "United States",
      ageRange: "55-64",
      email: "james.t@example.com",
    },
    conditionSlug: "knee-osteoarthritis",
    treatmentSlug: "msc-therapy",
    treatmentDate: "2024-03",
    cost: { range: "$8,000–$10,000", currency: "USD", isConfidential: false },
    ratingOverall: 5,
    ratings: { outcome: 5, communication: 5, facility: 5, value: 4, refer: 5 },
    headline: "Clear communication and a smooth experience",
    body: {
      condition: "Long-standing knee osteoarthritis limiting my activity.",
      whyChosen: "Strong reviews, GMP lab, and English-speaking staff.",
      treatmentDescription:
        "A packaged MSC protocol over several days with imaging-guided injections.",
      outcome:
        "Noticeable reduction in pain and better mobility over a few months.",
      experience:
        "Staff were responsive and the facility was modern and clean.",
      improvement: "A clearer written aftercare plan would have helped.",
    },
    whyChosenTags: ["High ratings", "Accreditation", "Language support"],
    wouldRecommend: true,
    providerResponse: {
      body: "Thank you, James. We're glad the protocol helped and we've since expanded our written aftercare guides.",
    },
  },
  {
    clinicSlug: "renova-cell-institute",
    status: "approved",
    isVerified: false,
    reviewer: {
      isAnonymous: true,
      country: "Canada",
      email: "anon1@example.com",
    },
    conditionSlug: "rheumatoid-arthritis",
    treatmentSlug: "iv-systemic-therapy",
    treatmentDate: "2024-06",
    cost: { isConfidential: true },
    ratingOverall: 4,
    ratings: { outcome: 4, communication: 5, facility: 4, value: 4, refer: 4 },
    headline: "Professional team, fair pricing",
    body: {
      whyChosen: "Referral from another patient and transparent pricing.",
      outcome: "Some improvement in fatigue and joint comfort.",
      experience: "Good communication before and after travel.",
    },
    whyChosenTags: ["Referral", "Price fit"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "renova-cell-institute",
    status: "pending",
    reviewer: {
      displayName: "M. K.",
      country: "United Kingdom",
      email: "mk@example.com",
    },
    conditionSlug: "anti-aging-longevity",
    treatmentSlug: "exosome-therapy",
    ratingOverall: 5,
    ratings: { outcome: 5, communication: 5, facility: 5, value: 5, refer: 5 },
    headline: "Awaiting moderation",
    body: { outcome: "Felt more energetic afterward." },
    whyChosenTags: ["High ratings"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "vitalis-regenerative",
    status: "approved",
    isVerified: true,
    verificationMethod: "email_confirmed",
    reviewer: {
      displayName: "Sofia R.",
      country: "United States",
      ageRange: "45-54",
      email: "sofia.r@example.com",
    },
    conditionSlug: "hip-osteoarthritis",
    treatmentSlug: "msc-therapy",
    treatmentDate: "2024-01",
    cost: { range: "$6,000–$8,000", currency: "USD", isConfidential: false },
    ratingOverall: 4,
    ratings: { outcome: 4, communication: 5, facility: 4, value: 5, refer: 4 },
    headline: "Great value and aftercare",
    body: {
      condition: "Hip osteoarthritis after years of running.",
      whyChosen:
        "Package pricing was transparent and the team was hospital-affiliated.",
      outcome: "Gradual improvement in comfort walking.",
      experience: "Follow-up calls were a nice touch.",
    },
    whyChosenTags: ["Price fit", "Accreditation"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "vitalis-regenerative",
    status: "approved",
    reviewer: {
      isAnonymous: true,
      country: "Spain",
      email: "anon2@example.com",
    },
    conditionSlug: "neuropathy",
    treatmentSlug: "cord-blood-therapy",
    ratingOverall: 4,
    ratings: { outcome: 3, communication: 5, facility: 4, value: 4, refer: 4 },
    headline: "Caring staff",
    body: {
      experience: "The staff were patient and answered all my questions.",
    },
    whyChosenTags: ["Language support", "Referral"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "novastem-bangkok",
    status: "approved",
    isVerified: true,
    verificationMethod: "online_form",
    reviewer: {
      displayName: "Daniel W.",
      country: "Australia",
      ageRange: "35-44",
      email: "daniel.w@example.com",
    },
    conditionSlug: "sports-injuries",
    treatmentSlug: "adipose-derived-therapy",
    treatmentDate: "2024-05",
    cost: { range: "$5,000–$7,000", currency: "USD", isConfidential: false },
    ratingOverall: 5,
    ratings: { outcome: 5, communication: 4, facility: 5, value: 5, refer: 5 },
    headline: "Back to training sooner than expected",
    body: {
      condition: "Recurring shoulder issue from sport.",
      whyChosen: "Proximity for a regional trip and strong facility.",
      outcome: "Returned to training gradually over two months.",
      experience: "Clean, modern facility with attentive staff.",
    },
    whyChosenTags: ["Proximity", "High ratings"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "novastem-bangkok",
    status: "approved",
    reviewer: {
      isAnonymous: true,
      country: "Singapore",
      email: "anon3@example.com",
    },
    conditionSlug: "skin-aesthetic",
    treatmentSlug: "exosome-therapy",
    ratingOverall: 4,
    ratings: { outcome: 4, communication: 4, facility: 5, value: 3, refer: 4 },
    headline: "Good facility, premium price",
    body: { improvement: "Pricing felt a little high for the package." },
    whyChosenTags: ["High ratings"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "biorestore-bogota",
    status: "approved",
    reviewer: {
      displayName: "Andrés P.",
      country: "Colombia",
      email: "andres.p@example.com",
    },
    conditionSlug: "joint-pain",
    treatmentSlug: "prp",
    treatmentDate: "2024-04",
    cost: { range: "$1,200–$2,000", currency: "USD", isConfidential: false },
    ratingOverall: 4,
    ratings: { outcome: 4, communication: 4, facility: 3, value: 5, refer: 4 },
    headline: "Affordable and straightforward",
    body: {
      whyChosen: "Accessible pricing close to home.",
      outcome: "Reduced knee discomfort after a few sessions.",
    },
    whyChosenTags: ["Price fit", "Proximity"],
    wouldRecommend: true,
  },
  {
    clinicSlug: "biorestore-bogota",
    status: "spam",
    reviewer: { isAnonymous: true, email: "spam@example.com" },
    ratingOverall: 1,
    ratings: {},
    headline: "Buy followers now",
    body: {},
    whyChosenTags: [],
    wouldRecommend: false,
  },
];

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
  headline: "Find and trust regenerative-medicine clinics",
  subhead:
    "Compare accredited stem cell clinics worldwide by treatment, condition, location, and verified patient reviews.",
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
export const FEATURED_CLINIC_SLUGS = [
  "renova-cell-institute",
  "vitalis-regenerative",
];

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

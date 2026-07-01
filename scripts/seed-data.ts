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
  },
  {
    name: "Autologous (own-cell) Therapy",
    slug: "autologous-therapy",
    category: "Cell therapies",
    icon: "RefreshCw",
    shortDescription: "Treatments using a patient's own cells.",
    order: 2,
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
  },
  {
    name: "Umbilical Cord / Cord-Blood Therapy",
    slug: "cord-blood-therapy",
    category: "Cell therapies",
    icon: "Baby",
    shortDescription: "Cells sourced from umbilical cord tissue or cord blood.",
    order: 6,
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
    website: "https://example.com/renova",
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
          "Yes — an initial consultation reviews your history and goals before any protocol is proposed.",
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
    website: "https://example.com/vitalis",
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
    website: "https://example.com/novastem",
    contactEmail: "care@novastem.example",
    faqs: [
      {
        question: "Do you support medical travel?",
        answer:
          "Yes — we coordinate scheduling and provide documentation for international patients.",
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
    website: "https://example.com/cayman",
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
      body: "Thank you, James — we're glad the protocol helped and we've since expanded our written aftercare guides.",
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
    description: "Get listed in the StemConnect directory.",
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
      "StemConnect made it easy to compare clinics and see real reviews before reaching out.",
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

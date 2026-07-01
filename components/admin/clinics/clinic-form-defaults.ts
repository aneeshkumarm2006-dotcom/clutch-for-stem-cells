/**
 * Server-safe default values for the clinic form.
 *
 * Intentionally NOT a `"use client"` module: the New-clinic Server Component
 * (`/admin/clinics/new`) calls `emptyClinic()` on the server. Exports from a
 * `"use client"` file become client-reference stubs when imported into server
 * code, so calling them there throws ("(0 , x) is not a function"). Keeping the
 * factory here lets both the server page and the client form use the real fn.
 *
 * `ClinicFormValues` is imported type-only — types are erased at build time, so
 * this creates no runtime dependency on the client form module.
 */
import type { ClinicFormValues } from "@/components/admin/clinics/clinic-form";

export function emptyClinic(): ClinicFormValues {
  return {
    name: "",
    slug: "",
    status: "draft",
    tier: "basic",
    tagline: "",
    description: "",
    verification: { isVerified: false, badge: undefined, method: "", notes: "" },
    gallery: [],
    videoUrl: "",
    treatmentTypes: [],
    conditionsTreated: [],
    cellSources: [],
    serviceFocus: [],
    accreditations: [],
    currency: "USD",
    priceNote: "",
    team: [],
    languages: [],
    locations: [{ isHQ: true }],
    website: "",
    social: {},
    contactEmail: "",
    caseStudies: [],
    faqs: [],
    highlights: [],
    isClaimed: false,
    seo: {},
  };
}

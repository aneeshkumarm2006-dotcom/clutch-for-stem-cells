"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useForm,
  useFieldArray,
  Controller,
  type Control,
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
} from "react-hook-form";
import { Eye, Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TextField,
  TextareaField,
  SelectField,
  Label,
} from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { ImagePicker, GalleryField } from "@/components/admin/image-picker";
import { MultiSelect, type MultiOption } from "@/components/admin/multi-select";
import { TagInput } from "@/components/admin/tag-input";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { scanContentFlags } from "@/lib/content-flags";
import { cn } from "@/lib/utils";
import {
  CLINIC_STATUSES,
  CLINIC_TIERS,
  EXTERNAL_SENTIMENTS,
  PRICE_MODELS,
  TEAM_SIZES,
  VERIFICATION_BADGES,
  SUPPORTED_CURRENCIES,
} from "@/lib/enums";
import type { ImageView } from "@/lib/admin/serialize";

// ── Form value shape ─────────────────────────────────────────────────────────

interface PersonValue {
  name: string;
  title?: string;
  credentials?: string;
  bio?: string;
  photo?: ImageView;
}
interface LocationValue {
  isHQ: boolean;
  addressLine?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  phone?: string;
}
interface CaseStudyValue {
  title: string;
  conditionId?: string;
  summary?: string;
  outcome?: string;
  images: ImageView[];
  isAnonymized: boolean;
}
interface FaqValue {
  question: string;
  answer: string;
}
/** One row of the cost page's price table. */
interface PriceItemValue {
  label: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  unit?: string;
  note?: string;
}
interface PriceSourceValue {
  label: string;
  url?: string;
}

export interface ClinicFormValues {
  name: string;
  slug: string;
  status: string;
  tier: string;
  tagline?: string;
  description?: string;
  verification: {
    isVerified: boolean;
    verifiedAt?: string;
    badge?: string;
    method?: string;
    notes?: string;
  };
  logo?: ImageView;
  coverImage?: ImageView;
  gallery: ImageView[];
  videoUrl?: string;
  treatmentTypes: string[];
  conditionsTreated: string[];
  cellSources: string[];
  serviceFocus: { treatmentId: string; percent: number }[];
  accreditations: string[];
  priceMin?: number;
  priceMax?: number;
  currency: string;
  priceModel?: string;
  priceNote?: string;
  foundedYear?: number;
  teamSize?: string;
  physiciansCount?: number;
  medicalDirector?: PersonValue;
  team: PersonValue[];
  languages: string[];
  locations: LocationValue[];
  website?: string;
  social: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    x?: string;
    youtube?: string;
  };
  contactEmail?: string;
  caseStudies: CaseStudyValue[];
  faqs: FaqValue[];
  highlights: string[];
  ownerUserId?: string;
  isClaimed: boolean;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    canonicalUrl?: string;
    noindex?: boolean;
  };
  /** Copy + meta for the child `/clinic/[slug]/reviews` page. */
  reviewsPage: {
    heading?: string;
    intro?: string;
    introEmpty?: string;
    bodyMarkdown?: string;
    ctaHeading?: string;
    ctaBody?: string;
    seo: {
      metaTitle?: string;
      metaDescription?: string;
      ogImage?: string;
      canonicalUrl?: string;
      noindex?: boolean;
    };
  };
  /** Price data + copy for the child `/clinic/[slug]/cost` page. */
  costPage: {
    heading?: string;
    intro?: string;
    introEmpty?: string;
    items: PriceItemValue[];
    includes: string[];
    excludes: string[];
    insuranceNote?: string;
    financingNote?: string;
    bodyMarkdown?: string;
    faqs: FaqValue[];
    sources: PriceSourceValue[];
    /** `YYYY-MM-DD` from `<input type="date">`; Zod coerces it on save. */
    lastVerifiedAt?: string;
    ctaHeading?: string;
    ctaBody?: string;
    seo: {
      metaTitle?: string;
      metaDescription?: string;
      ogImage?: string;
      canonicalUrl?: string;
      noindex?: boolean;
    };
  };
  /**
   * Third-party reception shown on the reviews page. Data, not copy, so it sits
   * beside `reviewsPage` rather than inside it — same split as `costPage.items`.
   */
  externalReviews: {
    google: {
      rating?: number;
      reviewCount?: number;
      summary?: string;
      themes: string[];
      url?: string;
      /** `YYYY-MM-DD` from `<input type="date">`; Zod coerces it on save. */
      checkedAt?: string;
    };
    reddit: {
      summary?: string;
      threadCount?: number;
      sentiment?: string;
      themes: string[];
      sources: PriceSourceValue[];
      checkedAt?: string;
    };
  };
}

export interface ClinicFormOptions {
  treatments: MultiOption[];
  conditions: MultiOption[];
  cellSources: MultiOption[];
  accreditations: MultiOption[];
  providers: { value: string; label: string }[];
}

const SECTIONS = [
  ["basics", "Basics"],
  ["media", "Description & media"],
  ["services", "Treatments & focus"],
  ["accreditations", "Accreditations"],
  ["pricing", "Pricing"],
  ["company", "Company facts"],
  ["team", "Medical director & team"],
  ["locations", "Locations"],
  ["stories", "Case studies & FAQs"],
  ["contact", "Contact & social"],
  ["verification", "Verification"],
  ["ownership", "Ownership"],
  ["seo", "SEO overrides"],
  ["reviews-page", "Reviews page"],
  ["external-reviews", "Off-site reception"],
  ["cost-page", "Cost page"],
] as const;

const opt = (vals: readonly string[]) =>
  vals.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

// `emptyClinic()` lives in `./clinic-form-defaults` (a non-client module) so the
// New-clinic Server Component can call it without hitting the client-reference
// stub error. Re-exported here for backward-compatible imports.
export { emptyClinic } from "@/components/admin/clinics/clinic-form-defaults";

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-6"
    >
      <h2 className="font-display text-[17px] font-semibold text-text-primary">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-[13px] text-text-muted">{description}</p>
      ) : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/**
 * ContentFlagWarning — live "cure/guaranteed" language check (§8.8). Advisory:
 * surfaces unsupported-efficacy phrasing in provider copy so the editor can
 * soften it before publishing. Never blocks save.
 */
function ContentFlagWarning({ texts }: { texts: (string | undefined)[] }) {
  const flags = React.useMemo(() => scanContentFlags(texts), [texts]);
  if (flags.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning-fg/25 bg-warning-bg px-3 py-2.5 text-[12.5px] text-warning-fg">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div>
        <span className="font-semibold">Possible unsupported claim.</span> Avoid
        implying a guaranteed or curative outcome ({" "}
        {flags.map((f, i) => (
          <React.Fragment key={f.phrase}>
            {i > 0 ? ", " : ""}
            <span className="font-medium">“{f.phrase}”</span>
          </React.Fragment>
        ))}
        ). Treatments must not be presented as proven efficacy (§14).
      </div>
    </div>
  );
}

// ── Service-focus builder ────────────────────────────────────────────────────

function ServiceFocusBuilder({
  treatments,
  watch,
  setValue,
}: {
  treatments: MultiOption[];
  watch: UseFormWatch<ClinicFormValues>;
  setValue: UseFormSetValue<ClinicFormValues>;
}) {
  const selected = watch("treatmentTypes") ?? [];
  const focus = watch("serviceFocus") ?? [];

  // Keep one focus row per selected treatment.
  React.useEffect(() => {
    const byId = new Map(focus.map((f) => [f.treatmentId, f.percent]));
    const next = selected.map((id) => ({
      treatmentId: id,
      percent: byId.get(id) ?? 0,
    }));
    const changed =
      next.length !== focus.length ||
      next.some((n, i) => focus[i]?.treatmentId !== n.treatmentId);
    if (changed) setValue("serviceFocus", next, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(",")]);

  if (selected.length === 0) {
    return (
      <p className="text-[13px] text-text-muted">
        Select treatments above to set the service-focus split.
      </p>
    );
  }

  const total = focus.reduce((s, f) => s + (Number(f.percent) || 0), 0);
  const labelFor = (id: string) =>
    treatments.find((t) => t.value === id)?.label ?? id;

  const setPercent = (id: string, percent: number) => {
    setValue(
      "serviceFocus",
      focus.map((f) => (f.treatmentId === id ? { ...f, percent } : f)),
      { shouldDirty: true },
    );
  };

  return (
    <div className="space-y-3">
      {focus.map((f) => (
        <div key={f.treatmentId} className="flex items-center gap-3.5">
          <span className="w-24 flex-none text-[13.5px] font-medium text-slate-700 sm:w-40">
            {labelFor(f.treatmentId)}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={f.percent}
            onChange={(e) => setPercent(f.treatmentId, Number(e.target.value))}
            className="h-1.5 flex-1 accent-primary"
          />
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={f.percent}
              onChange={(e) =>
                setPercent(f.treatmentId, Number(e.target.value) || 0)
              }
              className="h-9 w-16 text-center"
            />
            <span className="text-[13px] text-text-muted">%</span>
          </div>
        </div>
      ))}
      <div
        className={cn(
          "flex items-center gap-2 text-[12.5px] font-semibold",
          total === 100 ? "text-success" : "text-warning-fg",
        )}
      >
        {total === 100 ? (
          <Check className="size-3.5" />
        ) : (
          <AlertCircle className="size-3.5" />
        )}
        Total: {total}%{total !== 100 ? " (aim for 100%)" : ""}
      </div>
    </div>
  );
}

// ── Repeatable people (medical director / team) ──────────────────────────────

function PersonFields({
  control,
  register,
  prefix,
}: {
  control: Control<ClinicFormValues>;
  register: UseFormRegister<ClinicFormValues>;
  prefix: `team.${number}` | "medicalDirector";
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Name" {...register(`${prefix}.name` as const)} />
      <TextField
        label="Title"
        placeholder="Medical director"
        {...register(`${prefix}.title` as const)}
      />
      <TextField
        label="Credentials"
        placeholder="MD, PhD"
        {...register(`${prefix}.credentials` as const)}
      />
      <Controller
        control={control}
        name={`${prefix}.photo` as const}
        render={({ field }) => (
          <ImagePicker
            label="Photo"
            value={field.value as ImageView | undefined}
            onChange={field.onChange}
            folder="clinics/team"
            aspect="square"
          />
        )}
      />
      <TextareaField
        label="Bio"
        wrapperClassName="sm:col-span-2"
        rows={2}
        {...register(`${prefix}.bio` as const)}
      />
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────

export function ClinicForm({
  mode,
  clinicId,
  slug: existingSlug,
  defaultValues,
  options,
}: {
  mode: "create" | "edit";
  clinicId?: string;
  slug?: string;
  defaultValues: ClinicFormValues;
  options: ClinicFormOptions;
}) {
  const router = useRouter();
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    formState: { isDirty, errors },
  } = useForm<ClinicFormValues>({ defaultValues });

  const [saving, setSaving] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(mode === "edit");
  const [slugStatus, setSlugStatus] = React.useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");
  const [active, setActive] = React.useState<string>("basics");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const teamArray = useFieldArray({ control, name: "team" });
  const locationsArray = useFieldArray({ control, name: "locations" });
  const caseStudiesArray = useFieldArray({ control, name: "caseStudies" });
  const faqsArray = useFieldArray({ control, name: "faqs" });
  const costItemsArray = useFieldArray({ control, name: "costPage.items" });
  const costFaqsArray = useFieldArray({ control, name: "costPage.faqs" });
  const costSourcesArray = useFieldArray({ control, name: "costPage.sources" });
  const redditSourcesArray = useFieldArray({
    control,
    name: "externalReviews.reddit.sources",
  });

  // Warn before leaving with unsaved changes (tab close / refresh).
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Auto-slug from name until the slug is manually edited.
  const name = watch("name");
  React.useEffect(() => {
    if (!slugEdited && name) {
      setValue("slug", slugify(name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Section scroll-spy.
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const checkSlug = async (value: string) => {
    if (!value) return;
    setSlugStatus("checking");
    try {
      const res = await adminFetch<{ available: boolean }>(
        `/api/admin/clinics/check-slug?slug=${encodeURIComponent(value)}${
          clinicId ? `&excludeId=${clinicId}` : ""
        }`,
      );
      setSlugStatus(res.available ? "ok" : "taken");
    } catch {
      setSlugStatus("idle");
    }
  };

  const buildPayload = (status: string): ClinicFormValues => {
    const v = getValues();
    const num = (n: unknown) =>
      n === "" || n == null || Number.isNaN(Number(n)) ? undefined : Number(n);
    return {
      ...v,
      status,
      priceMin: num(v.priceMin),
      priceMax: num(v.priceMax),
      foundedYear: num(v.foundedYear),
      physiciansCount: num(v.physiciansCount),
      // Drop an empty medical director.
      medicalDirector: v.medicalDirector?.name?.trim()
        ? v.medicalDirector
        : undefined,
      // Drop untouched repeatable rows so an empty "Add …" row can't fail
      // server validation. Partially-filled rows are kept so the (now
      // field-named) validation error guides the user to complete them.
      team: (v.team ?? []).filter((m) => m.name?.trim()),
      faqs: (v.faqs ?? []).filter(
        (f) => f.question?.trim() || f.answer?.trim(),
      ),
      caseStudies: (v.caseStudies ?? []).filter(
        (c) => c.title?.trim() || c.summary?.trim() || c.outcome?.trim(),
      ),
      locations: (v.locations ?? []).map((l) => ({
        ...l,
        lat: num(l.lat),
        lng: num(l.lng),
      })),
      serviceFocus: (v.serviceFocus ?? []).filter((f) => f.percent > 0),
      ownerUserId: v.ownerUserId || undefined,
      costPage: {
        ...v.costPage,
        // Same treatment as the top-level price fields: `<input type="number">`
        // hands back a string, and a blank one must become `undefined` rather
        // than `NaN`. A row with neither bound is kept — that is the clinic
        // offering the line but quoting it privately.
        items: (v.costPage?.items ?? [])
          .filter((i) => i.label?.trim())
          .map((i) => ({
            ...i,
            priceMin: num(i.priceMin),
            priceMax: num(i.priceMax),
          })),
        faqs: (v.costPage?.faqs ?? []).filter(
          (f) => f.question?.trim() || f.answer?.trim(),
        ),
        sources: (v.costPage?.sources ?? []).filter((s) => s.label?.trim()),
      },
      // Same string-from-`<input type="number">` problem as the price fields.
      // An empty sentiment is submitted as `""` by the select, which is not a
      // member of the enum, so it has to become `undefined` rather than fail
      // validation for a field the editor simply left alone.
      externalReviews: {
        google: {
          ...v.externalReviews?.google,
          rating: num(v.externalReviews?.google?.rating),
          reviewCount: num(v.externalReviews?.google?.reviewCount),
        },
        reddit: {
          ...v.externalReviews?.reddit,
          threadCount: num(v.externalReviews?.reddit?.threadCount),
          sentiment: v.externalReviews?.reddit?.sentiment || undefined,
          sources: (v.externalReviews?.reddit?.sources ?? []).filter((s) =>
            s.label?.trim(),
          ),
        },
      },
    };
  };

  const submit = async (status: string) => {
    const payload = buildPayload(status);
    if (!payload.name?.trim() || !payload.slug?.trim()) {
      toast.error("Name and slug are required.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/admin/clinics", {
          method: "POST",
          body: payload,
        });
        toast.success("Clinic created");
        router.push(`/admin/clinics/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/admin/clinics/${clinicId}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Changes saved");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const setHQ = (index: number) => {
    locationsArray.fields.forEach((_, i) =>
      setValue(`locations.${i}.isHQ`, i === index, { shouldDirty: true }),
    );
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <PageHeader
        title={mode === "create" ? "New clinic" : watch("name") || "Clinic"}
        breadcrumb={{ label: "Clinics", href: "/admin/clinics" }}
        badge={
          isDirty ? (
            <Badge variant="warning" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-warning" />
              Unsaved changes
            </Badge>
          ) : null
        }
      >
        {mode === "edit" && existingSlug ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clinic/${existingSlug}`} target="_blank">
              <Eye className="size-4" />
              Live preview
            </Link>
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => submit("draft")}
        >
          Save as draft
        </Button>
        <Button size="sm" disabled={saving} onClick={() => submit("published")}>
          Publish
        </Button>
      </PageHeader>

      <div className="flex items-start gap-0">
        {/* Section rail */}
        <nav className="sticky top-20 hidden w-52 flex-none p-6 lg:block">
          <div className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Sections
          </div>
          <div className="grid gap-0.5 text-[13.5px]">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActive(id)}
                className={cn(
                  "rounded-lg px-2.5 py-2 transition-colors",
                  active === id
                    ? "bg-tint font-semibold text-azure-700"
                    : "text-text-secondary hover:bg-surface-alt",
                )}
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* Form body */}
        <div className="min-w-0 flex-1 space-y-4 p-5 lg:py-6 lg:pr-7">
          <Section id="basics" title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Name"
                required
                error={errors.name?.message}
                {...register("name", { required: "Name is required" })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="slug" required>
                  Slug
                </Label>
                <Input
                  id="slug"
                  {...register("slug", {
                    onChange: () => {
                      setSlugEdited(true);
                      setSlugStatus("idle");
                    },
                    onBlur: (e) => checkSlug(e.target.value),
                  })}
                />
                <p
                  className={cn(
                    "text-[12.5px]",
                    slugStatus === "taken"
                      ? "text-danger"
                      : slugStatus === "ok"
                        ? "text-success"
                        : "text-text-muted",
                  )}
                >
                  {slugStatus === "checking"
                    ? "Checking availability…"
                    : slugStatus === "taken"
                      ? "That slug is taken."
                      : slugStatus === "ok"
                        ? "Slug is available."
                        : "Used in the public URL: /clinic/your-slug"}
                </p>
              </div>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <SelectField
                    label="Status"
                    options={opt(CLINIC_STATUSES)}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="tier"
                render={({ field }) => (
                  <SelectField
                    label="Tier"
                    options={opt(CLINIC_TIERS)}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <TextField
              label="Tagline"
              placeholder="Short one-line positioning"
              {...register("tagline")}
            />
          </Section>

          <Section
            id="media"
            title="Description & media"
            description="Logo, cover, gallery, and the long description shown on the profile."
          >
            <TextareaField
              label="Description"
              hint="Supports Markdown. Aim for 120+ characters for a complete profile."
              rows={6}
              {...register("description")}
            />
            <ContentFlagWarning texts={[watch("description"), watch("tagline")]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="logo"
                render={({ field }) => (
                  <ImagePicker
                    label="Logo"
                    aspect="square"
                    value={field.value}
                    onChange={field.onChange}
                    folder="clinics/logos"
                  />
                )}
              />
              <Controller
                control={control}
                name="coverImage"
                render={({ field }) => (
                  <ImagePicker
                    label="Cover image"
                    value={field.value}
                    onChange={field.onChange}
                    folder="clinics/covers"
                  />
                )}
              />
            </div>
            <Controller
              control={control}
              name="gallery"
              render={({ field }) => (
                <GalleryField
                  label="Gallery"
                  value={field.value ?? []}
                  onChange={field.onChange}
                  folder="clinics/gallery"
                />
              )}
            />
            <TextField
              label="Video URL"
              placeholder="https://youtube.com/watch?v=…"
              {...register("videoUrl")}
            />
          </Section>

          <Section
            id="services"
            title="Treatments & focus"
            description="Select the treatments offered, then set the service-focus split."
          >
            <div className="space-y-2">
              <Label>Treatments offered</Label>
              <Controller
                control={control}
                name="treatmentTypes"
                render={({ field }) => (
                  <MultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    options={options.treatments}
                    addLabel="Add treatment"
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Service-focus split</Label>
              <ServiceFocusBuilder
                treatments={options.treatments}
                watch={watch}
                setValue={setValue}
              />
            </div>
            <div className="space-y-2">
              <Label>Conditions treated</Label>
              <Controller
                control={control}
                name="conditionsTreated"
                render={({ field }) => (
                  <MultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    options={options.conditions}
                    addLabel="Add condition"
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Cell sources</Label>
              <Controller
                control={control}
                name="cellSources"
                render={({ field }) => (
                  <MultiSelect
                    variant="pills"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    options={options.cellSources}
                  />
                )}
              />
            </div>
          </Section>

          <Section id="accreditations" title="Accreditations">
            <Controller
              control={control}
              name="accreditations"
              render={({ field }) => (
                <MultiSelect
                  variant="pills"
                  value={field.value ?? []}
                  onChange={field.onChange}
                  options={options.accreditations}
                />
              )}
            />
          </Section>

          <Section id="pricing" title="Pricing">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField
                label="Price min"
                type="number"
                {...register("priceMin")}
              />
              <TextField
                label="Price max"
                type="number"
                {...register("priceMax")}
              />
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <SelectField
                    label="Currency"
                    options={SUPPORTED_CURRENCIES.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="priceModel"
                render={({ field }) => (
                  <SelectField
                    label="Price model"
                    placeholder="Select…"
                    options={PRICE_MODELS.map((m) => ({
                      value: m,
                      label: m.replace(/_/g, " "),
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <TextField
              label="Pricing note"
              placeholder="e.g. Includes consultation and follow-up"
              {...register("priceNote")}
            />
          </Section>

          <Section id="company" title="Company facts">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                label="Founded year"
                type="number"
                {...register("foundedYear")}
              />
              <Controller
                control={control}
                name="teamSize"
                render={({ field }) => (
                  <SelectField
                    label="Team size"
                    placeholder="Select…"
                    options={TEAM_SIZES.map((s) => ({ value: s, label: s }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <TextField
                label="Physicians count"
                type="number"
                {...register("physiciansCount")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Languages</Label>
              <Controller
                control={control}
                name="languages"
                render={({ field }) => (
                  <TagInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="English, Spanish…"
                  />
                )}
              />
            </div>
          </Section>

          <Section id="team" title="Medical director & team">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 text-[13px] font-semibold text-text-secondary">
                Medical director
              </div>
              <PersonFields
                control={control}
                register={register}
                prefix="medicalDirector"
              />
            </div>
            {teamArray.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text-secondary">
                    Team member {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => teamArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <PersonFields
                  control={control}
                  register={register}
                  prefix={`team.${i}`}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => teamArray.append({ name: "" })}
            >
              <Plus className="size-4" />
              Add team member
            </Button>
          </Section>

          <Section id="locations" title="Locations">
            {locationsArray.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setHQ(i)}
                    className={cn(
                      "rounded-sm px-2 py-1 text-[12px] font-semibold",
                      watch(`locations.${i}.isHQ`)
                        ? "bg-tint text-azure-700"
                        : "text-text-muted hover:bg-surface-alt",
                    )}
                  >
                    {watch(`locations.${i}.isHQ`) ? "HQ" : "Set as HQ"}
                  </button>
                  {locationsArray.fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => locationsArray.remove(i)}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Address"
                    wrapperClassName="sm:col-span-2"
                    {...register(`locations.${i}.addressLine` as const)}
                  />
                  <TextField label="City" {...register(`locations.${i}.city` as const)} />
                  <TextField
                    label="Region / state"
                    {...register(`locations.${i}.region` as const)}
                  />
                  <TextField
                    label="Country"
                    {...register(`locations.${i}.country` as const)}
                  />
                  <TextField
                    label="Country code"
                    placeholder="MX"
                    {...register(`locations.${i}.countryCode` as const)}
                  />
                  <TextField
                    label="Postal code"
                    {...register(`locations.${i}.postalCode` as const)}
                  />
                  <TextField
                    label="Phone"
                    {...register(`locations.${i}.phone` as const)}
                  />
                  <TextField
                    label="Latitude"
                    type="number"
                    {...register(`locations.${i}.lat` as const)}
                  />
                  <TextField
                    label="Longitude"
                    type="number"
                    {...register(`locations.${i}.lng` as const)}
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    [
                      watch(`locations.${i}.addressLine`),
                      watch(`locations.${i}.city`),
                      watch(`locations.${i}.country`),
                    ]
                      .filter(Boolean)
                      .join(", "),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[12.5px] text-text-link hover:underline"
                >
                  Look up coordinates on Google Maps →
                </a>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => locationsArray.append({ isHQ: false })}
            >
              <Plus className="size-4" />
              Add location
            </Button>
          </Section>

          <Section id="stories" title="Case studies & FAQs">
            <div className="space-y-3">
              <Label>Highlights</Label>
              <Controller
                control={control}
                name="highlights"
                render={({ field }) => (
                  <TagInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="Key selling points…"
                  />
                )}
              />
            </div>

            <div className="text-[13px] font-semibold text-text-secondary">
              Case studies
            </div>
            {caseStudiesArray.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text-secondary">
                    Case study {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => caseStudiesArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="space-y-3">
                  <TextField
                    label="Title"
                    {...register(`caseStudies.${i}.title` as const)}
                  />
                  <Controller
                    control={control}
                    name={`caseStudies.${i}.conditionId` as const}
                    render={({ field }) => (
                      <SelectField
                        label="Condition"
                        placeholder="Select…"
                        options={options.conditions}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                  <TextareaField
                    label="Summary"
                    rows={2}
                    {...register(`caseStudies.${i}.summary` as const)}
                  />
                  <TextareaField
                    label="Outcome"
                    rows={2}
                    {...register(`caseStudies.${i}.outcome` as const)}
                  />
                  <ContentFlagWarning
                    texts={[
                      watch(`caseStudies.${i}.summary` as const),
                      watch(`caseStudies.${i}.outcome` as const),
                    ]}
                  />
                  <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                    <Controller
                      control={control}
                      name={`caseStudies.${i}.isAnonymized` as const}
                      render={({ field }) => (
                        <Toggle
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                          label="Anonymized"
                        />
                      )}
                    />
                    Anonymized (individual results vary)
                  </label>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                caseStudiesArray.append({
                  title: "",
                  images: [],
                  isAnonymized: true,
                })
              }
            >
              <Plus className="size-4" />
              Add case study
            </Button>

            <div className="pt-2 text-[13px] font-semibold text-text-secondary">
              FAQs
            </div>
            {faqsArray.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text-secondary">
                    FAQ {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => faqsArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="space-y-3">
                  <TextField
                    label="Question"
                    {...register(`faqs.${i}.question` as const)}
                  />
                  <TextareaField
                    label="Answer"
                    rows={2}
                    {...register(`faqs.${i}.answer` as const)}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => faqsArray.append({ question: "", answer: "" })}
            >
              <Plus className="size-4" />
              Add FAQ
            </Button>
          </Section>

          <Section id="contact" title="Contact & social">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Website" {...register("website")} />
              <TextField
                label="Contact email"
                type="email"
                {...register("contactEmail")}
              />
              <TextField label="LinkedIn" {...register("social.linkedin")} />
              <TextField label="Instagram" {...register("social.instagram")} />
              <TextField label="Facebook" {...register("social.facebook")} />
              <TextField label="X (Twitter)" {...register("social.x")} />
              <TextField label="YouTube" {...register("social.youtube")} />
            </div>
          </Section>

          <Section
            id="verification"
            title="Verification"
            description="Verification reflects accreditation/record checks, never an efficacy endorsement."
          >
            <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
              <Controller
                control={control}
                name="verification.isVerified"
                render={({ field }) => (
                  <Toggle
                    checked={field.value ?? false}
                    onCheckedChange={(c) => {
                      field.onChange(c);
                      if (c && !getValues("verification.verifiedAt")) {
                        setValue(
                          "verification.verifiedAt",
                          new Date().toISOString(),
                        );
                      }
                    }}
                    label="Verified"
                  />
                )}
              />
              Mark this clinic as verified
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="verification.badge"
                render={({ field }) => (
                  <SelectField
                    label="Badge level"
                    placeholder="Select…"
                    options={opt(VERIFICATION_BADGES)}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <TextField
                label="Method"
                placeholder="e.g. Accreditation record check"
                {...register("verification.method")}
              />
            </div>
            <TextareaField
              label="Notes"
              rows={2}
              {...register("verification.notes")}
            />
          </Section>

          <Section
            id="ownership"
            title="Ownership"
            description="Assign a provider account (Phase 2 self-serve) and claim status."
          >
            <Controller
              control={control}
              name="ownerUserId"
              render={({ field }) => (
                <SelectField
                  label="Owner (provider)"
                  placeholder="Unassigned"
                  options={options.providers}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
              <Controller
                control={control}
                name="isClaimed"
                render={({ field }) => (
                  <Toggle
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    label="Claimed"
                  />
                )}
              />
              Profile is claimed by its owner
            </label>
          </Section>

          <Section id="seo" title="SEO overrides">
            <TextField label="Meta title" {...register("seo.metaTitle")} />
            <TextareaField
              label="Meta description"
              rows={2}
              {...register("seo.metaDescription")}
            />
            <TextField label="OG image URL" {...register("seo.ogImage")} />
            <TextField
              label="Canonical URL"
              {...register("seo.canonicalUrl")}
            />
            <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
              <Controller
                control={control}
                name="seo.noindex"
                render={({ field }) => (
                  <Toggle
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    label="No-index"
                  />
                )}
              />
              Exclude from search engines (noindex)
            </label>
          </Section>

          <Section
            id="reviews-page"
            title="Reviews page"
            description="Copy and meta for /clinic/…/reviews, the clinic's own reviews URL. Every field is optional; leave one blank and the page keeps its auto-generated copy."
          >
            {mode === "edit" && existingSlug ? (
              <a
                href={`/clinic/${existingSlug}/reviews`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-link hover:underline"
              >
                <Eye className="size-3.5" aria-hidden="true" />
                Open the live reviews page
              </a>
            ) : null}

            <TextField
              label="Heading (H1)"
              placeholder={`${watch("name") || "Clinic name"} reviews`}
              hint="Defaults to “<clinic name> reviews”, the phrase people search."
              {...register("reviewsPage.heading")}
            />
            <TextareaField
              label="Intro paragraph"
              rows={3}
              hint="Shown under the heading once the clinic has published reviews. Default summarises the count, location and average rating."
              {...register("reviewsPage.intro")}
            />
            <TextareaField
              label="Intro paragraph (no reviews yet)"
              rows={2}
              hint="Used instead of the above while the clinic has zero published reviews."
              {...register("reviewsPage.introEmpty")}
            />
            <ContentFlagWarning
              texts={[
                watch("reviewsPage.intro"),
                watch("reviewsPage.introEmpty"),
                watch("reviewsPage.bodyMarkdown"),
                watch("reviewsPage.ctaBody"),
              ]}
            />

            <div className="space-y-1.5">
              <Label>Body content</Label>
              <Controller
                control={control}
                name="reviewsPage.bodyMarkdown"
                render={({ field }) => (
                  <MarkdownEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Optional editorial section rendered below the review list: how reviews are collected here, what patients consistently report, caveats…"
                  />
                )}
              />
              <p className="text-[12.5px] text-text-muted">
                Renders under the review list. Supports Markdown.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Sidebar card heading"
                placeholder={`Been treated at ${watch("name") || "this clinic"}?`}
                {...register("reviewsPage.ctaHeading")}
              />
              <TextareaField
                label="Sidebar card text"
                rows={2}
                placeholder="Reviews are moderated and published without the clinic's approval."
                {...register("reviewsPage.ctaBody")}
              />
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 text-[13px] font-semibold text-text-secondary">
                Meta overrides (reviews page only)
              </div>
              <div className="space-y-4">
                <TextField
                  label="Meta title"
                  {...register("reviewsPage.seo.metaTitle")}
                />
                <TextareaField
                  label="Meta description"
                  rows={2}
                  {...register("reviewsPage.seo.metaDescription")}
                />
                <TextField
                  label="OG image URL"
                  {...register("reviewsPage.seo.ogImage")}
                />
                <TextField
                  label="Canonical URL"
                  hint={`Leave blank to canonicalise to /clinic/${existingSlug || "your-slug"}/reviews.`}
                  {...register("reviewsPage.seo.canonicalUrl")}
                />
                <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
                  <Controller
                    control={control}
                    name="reviewsPage.seo.noindex"
                    render={({ field }) => (
                      <Toggle
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        label="No-index"
                      />
                    )}
                  />
                  Exclude the reviews page from search engines (noindex)
                </label>
                <p className="text-[12.5px] text-text-muted">
                  A clinic with no published reviews is no-indexed automatically
                  and kept out of the sitemap. This toggle only ever adds
                  no-index, it can&apos;t force one on.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="external-reviews"
            title="Off-site reception"
            description="What this clinic looks like on Google and Reddit, shown on the reviews page above our own reviews. Leave a half blank and it doesn't render — a clinic with no Google listing or no Reddit discussion is a normal state, not a gap to fill in."
          >
            <p className="rounded-lg border border-border bg-surface-alt p-3 text-[12.5px] leading-relaxed text-text-secondary">
              These numbers are never added to the clinic&apos;s own rating and
              are never emitted as structured data. Write the summaries in your
              own words: pasting a reviewer&apos;s text is their copyright, and
              one lifted sentence is not a fair reading of a whole listing.
            </p>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 text-[13px] font-semibold text-text-secondary">
                Google
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    placeholder="4.7"
                    hint="Google's average, restated. Needs a review count."
                    {...register("externalReviews.google.rating")}
                  />
                  <TextField
                    label="Number of Google ratings"
                    type="number"
                    min="0"
                    placeholder="110"
                    {...register("externalReviews.google.reviewCount")}
                  />
                </div>
                <TextareaField
                  label="Summary"
                  rows={3}
                  placeholder="Two or three sentences characterising what reviewers report — in your words, not theirs."
                  {...register("externalReviews.google.summary")}
                />
                <div className="space-y-1.5">
                  <Label>Recurring themes</Label>
                  <Controller
                    control={control}
                    name="externalReviews.google.themes"
                    render={({ field }) => (
                      <TagInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        placeholder="staff communication"
                      />
                    )}
                  />
                  <p className="text-[12.5px] text-text-muted">
                    Short noun phrases, strongest first.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Listing URL"
                    placeholder="https://www.google.com/maps/place/…"
                    {...register("externalReviews.google.url")}
                  />
                  <TextField
                    label="Last checked"
                    type="date"
                    hint="Shown on the page. An undated third-party rating implies a freshness we can't promise."
                    {...register("externalReviews.google.checkedAt")}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 text-[13px] font-semibold text-text-secondary">
                Reddit
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Overall sentiment"
                    placeholder="Not set"
                    hint="“Limited” means too little discussion to characterise, not a lukewarm verdict."
                    options={opt(EXTERNAL_SENTIMENTS)}
                    {...register("externalReviews.reddit.sentiment")}
                  />
                  <TextField
                    label="Threads read"
                    type="number"
                    min="0"
                    {...register("externalReviews.reddit.threadCount")}
                  />
                </div>
                <TextareaField
                  label="Summary"
                  rows={3}
                  placeholder="What patients actually report, hedged where the evidence is thin."
                  {...register("externalReviews.reddit.summary")}
                />
                <ContentFlagWarning
                  texts={[
                    watch("externalReviews.google.summary"),
                    watch("externalReviews.reddit.summary"),
                  ]}
                />
                <div className="space-y-1.5">
                  <Label>Recurring points</Label>
                  <Controller
                    control={control}
                    name="externalReviews.reddit.themes"
                    render={({ field }) => (
                      <TagInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        placeholder="cost vs. results"
                      />
                    )}
                  />
                </div>

                <div className="text-[13px] font-semibold text-text-secondary">
                  Threads read
                </div>
                {redditSourcesArray.fields.map((f, i) => (
                  <div
                    key={f.id}
                    className="flex items-end gap-3 rounded-lg border border-border p-4"
                  >
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <TextField
                        label="Thread title"
                        {...register(
                          `externalReviews.reddit.sources.${i}.label` as const,
                        )}
                      />
                      <TextField
                        label="URL"
                        {...register(
                          `externalReviews.reddit.sources.${i}.url` as const,
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => redditSourcesArray.remove(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      redditSourcesArray.append({ label: "", url: "" })
                    }
                  >
                    <Plus className="size-4" />
                    Add thread
                  </Button>
                  <TextField
                    label="Last checked"
                    type="date"
                    {...register("externalReviews.reddit.checkedAt")}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="cost-page"
            title="Cost page"
            description="Price table and copy for /clinic/…/cost, the clinic's own pricing URL. The table is the page's reason to exist; the copy fields are all optional and fall back to derived text."
          >
            {mode === "edit" && existingSlug ? (
              <a
                href={`/clinic/${existingSlug}/cost`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-link hover:underline"
              >
                <Eye className="size-3.5" aria-hidden="true" />
                Open the live cost page
              </a>
            ) : null}

            <TextField
              label="Heading (H1)"
              placeholder={`${watch("name") || "Clinic name"} cost`}
              hint="Defaults to “<clinic name> cost”, the phrase people search."
              {...register("costPage.heading")}
            />
            <TextareaField
              label="Intro paragraph"
              rows={3}
              hint="Shown when there is a price table. Answer-first: lead with the figure, because this is the sentence an AI answer engine lifts."
              {...register("costPage.intro")}
            />
            <TextareaField
              label="Intro paragraph (no published prices)"
              rows={2}
              hint="Used instead of the above while the price table is empty."
              {...register("costPage.introEmpty")}
            />
            <ContentFlagWarning
              texts={[
                watch("costPage.intro"),
                watch("costPage.introEmpty"),
                watch("costPage.bodyMarkdown"),
                watch("costPage.insuranceNote"),
                watch("costPage.ctaBody"),
              ]}
            />

            {/* Price table */}
            <div className="pt-2 text-[13px] font-semibold text-text-secondary">
              Price table
            </div>
            {costItemsArray.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text-secondary">
                    Row {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => costItemsArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="space-y-3">
                  <TextField
                    label="Treatment or service"
                    placeholder="Knee, bone marrow concentrate"
                    {...register(`costPage.items.${i}.label` as const)}
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <TextField
                      label="Price min"
                      type="number"
                      {...register(`costPage.items.${i}.priceMin` as const)}
                    />
                    <TextField
                      label="Price max"
                      type="number"
                      {...register(`costPage.items.${i}.priceMax` as const)}
                    />
                    <TextField
                      label="Currency"
                      placeholder={watch("currency") || "USD"}
                      hint="Blank uses the clinic's currency."
                      {...register(`costPage.items.${i}.currency` as const)}
                    />
                    <TextField
                      label="Billed"
                      placeholder="per joint"
                      {...register(`costPage.items.${i}.unit` as const)}
                    />
                  </div>
                  <TextareaField
                    label="Note"
                    rows={2}
                    hint="Shown under the row. Leave both prices blank for a line the clinic only quotes privately."
                    {...register(`costPage.items.${i}.note` as const)}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => costItemsArray.append({ label: "" })}
            >
              <Plus className="size-4" />
              Add price row
            </Button>

            {/* What the quote covers */}
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Included in the price</Label>
                <Controller
                  control={control}
                  name="costPage.includes"
                  render={({ field }) => (
                    <TagInput
                      value={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Consultation, imaging review…"
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billed separately</Label>
                <Controller
                  control={control}
                  name="costPage.excludes"
                  render={({ field }) => (
                    <TagInput
                      value={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Travel, lab work, follow-up…"
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextareaField
                label="Insurance"
                rows={3}
                placeholder="Whether insurance, Medicare, HSA or FSA apply."
                {...register("costPage.insuranceNote")}
              />
              <TextareaField
                label="Financing"
                rows={3}
                placeholder="Payment plans, deposits, financing partners."
                {...register("costPage.financingNote")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Body content</Label>
              <Controller
                control={control}
                name="costPage.bodyMarkdown"
                render={({ field }) => (
                  <MarkdownEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Optional editorial section under the tables: how the quote is built, how it compares, what to ask before paying a deposit…"
                  />
                )}
              />
            </div>

            {/* Cost FAQs — rendered on the page and emitted as FAQPage. */}
            <div className="pt-2 text-[13px] font-semibold text-text-secondary">
              Cost FAQs
            </div>
            {costFaqsArray.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text-secondary">
                    FAQ {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => costFaqsArray.remove(i)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="space-y-3">
                  <TextField
                    label="Question"
                    placeholder="Does insurance cover it?"
                    {...register(`costPage.faqs.${i}.question` as const)}
                  />
                  <TextareaField
                    label="Answer"
                    rows={2}
                    {...register(`costPage.faqs.${i}.answer` as const)}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => costFaqsArray.append({ question: "", answer: "" })}
            >
              <Plus className="size-4" />
              Add cost FAQ
            </Button>

            {/* Provenance */}
            <div className="pt-2 text-[13px] font-semibold text-text-secondary">
              Where the figures came from
            </div>
            {costSourcesArray.fields.map((f, i) => (
              <div
                key={f.id}
                className="flex items-end gap-3 rounded-lg border border-border p-4"
              >
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <TextField
                    label="Source"
                    placeholder="Clinic pricing page"
                    {...register(`costPage.sources.${i}.label` as const)}
                  />
                  <TextField
                    label="URL"
                    {...register(`costPage.sources.${i}.url` as const)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => costSourcesArray.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => costSourcesArray.append({ label: "", url: "" })}
              >
                <Plus className="size-4" />
                Add source
              </Button>
              <TextField
                label="Prices last checked"
                type="date"
                hint="Shown on the page. Re-check when a clinic changes its list."
                {...register("costPage.lastVerifiedAt")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Sidebar card heading"
                placeholder={`Get a price from ${watch("name") || "this clinic"}`}
                {...register("costPage.ctaHeading")}
              />
              <TextareaField
                label="Sidebar card text"
                rows={2}
                placeholder="Send your case and ask for the quote in writing, itemised."
                {...register("costPage.ctaBody")}
              />
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 text-[13px] font-semibold text-text-secondary">
                Meta overrides (cost page only)
              </div>
              <div className="space-y-4">
                <TextField
                  label="Meta title"
                  {...register("costPage.seo.metaTitle")}
                />
                <TextareaField
                  label="Meta description"
                  rows={2}
                  {...register("costPage.seo.metaDescription")}
                />
                <TextField
                  label="OG image URL"
                  {...register("costPage.seo.ogImage")}
                />
                <TextField
                  label="Canonical URL"
                  hint={`Leave blank to canonicalise to /clinic/${existingSlug || "your-slug"}/cost.`}
                  {...register("costPage.seo.canonicalUrl")}
                />
                <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
                  <Controller
                    control={control}
                    name="costPage.seo.noindex"
                    render={({ field }) => (
                      <Toggle
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        label="No-index"
                      />
                    )}
                  />
                  Exclude the cost page from search engines (noindex)
                </label>
                <p className="text-[12.5px] text-text-muted">
                  A clinic with no price table is still indexed: &ldquo;prices
                  are quoted privately&rdquo; is itself the answer to the query.
                  Use this toggle to withhold a specific page.
                </p>
              </div>
            </div>
          </Section>

          {mode === "edit" ? (
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Delete clinic
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete clinic"
        description="Soft-delete this clinic? It can be restored from the list later."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await adminFetch(`/api/admin/clinics/${clinicId}`, {
              method: "DELETE",
            });
            toast.success("Clinic deleted");
            router.push("/admin/clinics");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </form>
  );
}

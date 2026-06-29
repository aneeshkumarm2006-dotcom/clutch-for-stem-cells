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
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import {
  CLINIC_STATUSES,
  CLINIC_TIERS,
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
] as const;

const opt = (vals: readonly string[]) =>
  vals.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

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
          <span className="w-40 flex-none text-[13.5px] font-medium text-slate-700">
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
      locations: (v.locations ?? []).map((l) => ({
        ...l,
        lat: num(l.lat),
        lng: num(l.lng),
      })),
      serviceFocus: (v.serviceFocus ?? []).filter((f) => f.percent > 0),
      ownerUserId: v.ownerUserId || undefined,
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
            description="Verification reflects accreditation/record checks — never an efficacy endorsement."
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

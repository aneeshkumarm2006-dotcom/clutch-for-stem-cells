"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TextField, Label } from "@/components/ui/form-field";
import { MultiSelect } from "@/components/admin/multi-select";
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FaqRepeater, type FaqItem } from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { AdminClinicLandingRow } from "@/lib/admin/clinic-landings";
import type { TaxonomyOption } from "@/lib/admin/lookups";

interface FormState {
  id: string | null;
  slug: string;
  name: string;
  heading: string;
  intro: string;
  country: string;
  region: string;
  city: string;
  treatments: string[];
  conditions: string[];
  metaTitle: string;
  metaDescription: string;
  noindex: boolean;
  faqs: FaqItem[];
  isActive: boolean;
}

const EMPTY: FormState = {
  id: null,
  slug: "",
  name: "",
  heading: "",
  intro: "",
  country: "",
  region: "",
  city: "",
  treatments: [],
  conditions: [],
  metaTitle: "",
  metaDescription: "",
  noindex: false,
  faqs: [],
  isActive: true,
};

function toForm(row: AdminClinicLandingRow): FormState {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    heading: row.heading,
    intro: row.intro,
    country: row.filters.country,
    region: row.filters.region,
    city: row.filters.city,
    treatments: row.filters.treatments,
    conditions: row.filters.conditions,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    noindex: row.noindex,
    faqs: row.faqs,
    isActive: row.isActive,
  };
}

export function ClinicLandingsManager({
  rows,
  treatmentOptions,
  conditionOptions,
}: {
  rows: AdminClinicLandingRow[];
  treatmentOptions: TaxonomyOption[];
  conditionOptions: TaxonomyOption[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminClinicLandingRow | null>(
    null,
  );

  const set = (patch: Partial<FormState>) =>
    setForm((c) => (c ? { ...c, ...patch } : c));

  // Slug options are matched by *slug*, not id — the public route resolves
  // pinned treatment/condition filters by slug, same as the taxonomy routes do.
  const treatmentChoices = treatmentOptions.map((o) => ({
    value: o.slug,
    label: o.label,
  }));
  const conditionChoices = conditionOptions.map((o) => ({
    value: o.slug,
    label: o.label,
  }));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        heading: form.heading.trim() || undefined,
        intro: form.intro.trim() || undefined,
        filters: {
          country: form.country.trim() || undefined,
          region: form.region.trim() || undefined,
          city: form.city.trim() || undefined,
          treatments: form.treatments.length ? form.treatments : undefined,
          conditions: form.conditions.length ? form.conditions : undefined,
        },
        seo: {
          metaTitle: form.metaTitle.trim() || undefined,
          metaDescription: form.metaDescription.trim() || undefined,
          noindex: form.noindex,
        },
        faqs: form.faqs.filter((f) => f.question.trim() && f.answer.trim()),
        isActive: form.isActive,
      };

      if (form.id) {
        await adminFetch(`/api/admin/clinic-landings/${form.id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await adminFetch("/api/admin/clinic-landings", {
          method: "POST",
          body,
        });
      }
      toast.success("Landing page saved");
      setForm(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminFetch(`/api/admin/clinic-landings/${deleting.id}`, {
        method: "DELETE",
      });
      toast.success(`Deleted "${deleting.name}"`);
      setDeleting(null);
      if (form?.id === deleting.id) setForm(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  return (
    <>
      <PageHeader
        title="Clinic landing pages"
        description="Curated /clinics/… directory pages for cities, states, and metros."
      >
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="size-4" />
          New landing page
        </Button>
      </PageHeader>

      <div className="grid items-start gap-5 p-5 lg:grid-cols-[1fr_380px] lg:p-7">
        <div className="rounded-xl border border-border bg-surface">
          {rows.length === 0 ? (
            <p className="p-6 text-[13.5px] text-text-muted">
              No landing pages yet. Create one to publish a curated{" "}
              <code className="rounded bg-surface-alt px-1 py-0.5 text-[12px]">
                /clinics/…
              </code>{" "}
              page.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    form?.id === row.id && "bg-tint/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setForm(toForm(row))}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-text-primary">
                        {row.name}
                      </span>
                      {!row.isActive ? (
                        <span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                          Hidden
                        </span>
                      ) : null}
                      {row.noindex ? (
                        <span className="rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-semibold text-warning-fg">
                          noindex
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[12.5px] text-text-muted">
                      {row.path}
                      {row.metaTitle ? ` · ${row.metaTitle}` : ""}
                    </div>
                  </button>
                  <Link
                    href={row.path}
                    target="_blank"
                    aria-label={`Open ${row.path}`}
                    className="text-slate-400 hover:text-azure-700"
                  >
                    <ExternalLink className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    aria-label={`Delete ${row.name}`}
                    className="text-slate-400 hover:text-danger-fg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {form ? (
          <div className="space-y-3.5 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold text-text-primary">
                {form.id ? "Edit landing page" : "New landing page"}
              </h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="text-[12.5px] text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
            </div>

            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                set({
                  name,
                  // Only auto-derive while creating — an existing slug is a live
                  // URL and must not move because someone fixed a typo.
                  ...(form.id ? {} : { slug: slugify(name) }),
                });
              }}
              placeholder="Denver"
            />
            <TextField
              label="URL slug"
              value={form.slug}
              onChange={(e) => set({ slug: slugify(e.target.value) })}
              hint={`/clinics/${form.slug || "…"}`}
            />
            <TextField
              label="Page heading (H1)"
              value={form.heading}
              onChange={(e) => set({ heading: e.target.value })}
              placeholder={form.name ? `Stem cell clinics in ${form.name}` : ""}
            />
            <div className="space-y-1.5">
              <Label>Intro</Label>
              <Textarea
                rows={3}
                value={form.intro}
                onChange={(e) => set({ intro: e.target.value })}
                placeholder="Lede under the heading. Also the fallback meta description."
              />
            </div>

            <div className="bg-surface-alt/60 space-y-3.5 rounded-xl border border-border p-3.5">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">
                Which clinics appear
              </div>
              <TextField
                label="Country"
                value={form.country}
                onChange={(e) => set({ country: e.target.value })}
                placeholder="United States"
              />
              <TextField
                label="State / region"
                value={form.region}
                onChange={(e) => set({ region: e.target.value })}
                placeholder="Florida"
              />
              <TextField
                label="City"
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
                placeholder="Denver"
              />
              <div className="space-y-1.5">
                <Label>Treatments</Label>
                <MultiSelect
                  value={form.treatments}
                  onChange={(treatments) => set({ treatments })}
                  options={treatmentChoices}
                  addLabel="Add treatment"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conditions</Label>
                <MultiSelect
                  value={form.conditions}
                  onChange={(conditions) => set({ conditions })}
                  options={conditionChoices}
                  addLabel="Add condition"
                />
              </div>
              <p className="text-[12px] leading-snug text-text-muted">
                These match a clinic&apos;s own location and taxonomy exactly as
                the directory filters do. Leave a field blank to not filter on
                it.
              </p>
            </div>

            <div className="bg-surface-alt/60 space-y-3.5 rounded-xl border border-border p-3.5">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">
                Search engine (SEO)
              </div>
              <TextField
                label="Meta title"
                value={form.metaTitle}
                onChange={(e) => set({ metaTitle: e.target.value })}
                placeholder={form.heading || form.name}
              />
              <div className="space-y-1.5">
                <Label>Meta description</Label>
                <Textarea
                  rows={3}
                  value={form.metaDescription}
                  onChange={(e) => set({ metaDescription: e.target.value })}
                  placeholder="Shown in search results. Aim for ~155 characters."
                />
              </div>
              <p className="text-[12px] leading-snug text-text-muted">
                A meta title typed here is used exactly as written. Add the
                brand suffix yourself if you want one.
              </p>
              <label className="flex items-center justify-between py-1">
                <span className="text-[13px] text-text-secondary">
                  Hide from search engines (noindex)
                </span>
                <Toggle
                  checked={form.noindex}
                  onCheckedChange={(noindex) => set({ noindex })}
                  label="noindex"
                />
              </label>
            </div>

            <FaqRepeater
              value={form.faqs}
              onChange={(faqs) => set({ faqs })}
            />

            <label className="flex items-center justify-between py-1">
              <span className="text-[13.5px] font-semibold text-slate-700">
                Published
              </span>
              <Toggle
                checked={form.isActive}
                onCheckedChange={(isActive) => set({ isActive })}
                label="Published"
              />
            </label>

            <Button className="w-full" onClick={save} disabled={saving}>
              {form.id ? "Save changes" : "Create landing page"}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description={`${deleting?.path ?? ""} will start returning 404. Add a redirect if it has traffic.`}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

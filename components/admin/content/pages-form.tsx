"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TextField, TextareaField } from "@/components/ui/form-field";
import { ImagePicker, GalleryField } from "@/components/admin/image-picker";
import { MultiSelect } from "@/components/admin/multi-select";
import { adminFetch } from "@/lib/admin/client";
import type { SettingsView } from "@/lib/admin/settings";
import type { Option } from "@/lib/admin/lookups";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="font-display text-[17px] font-semibold text-text-primary">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-[13px] text-text-muted">{description}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function PagesForm({
  settings,
  clinicOptions,
}: {
  settings: SettingsView;
  clinicOptions: Option[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState(settings);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<SettingsView>) => setV((c) => ({ ...c, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/pages", {
        method: "PATCH",
        body: {
          hero: v.hero,
          popularSearches: v.popularSearches.filter((p) => p.label && p.href),
          featuredClinicIds: v.featuredClinicIds,
          testimonials: v.testimonials.filter((t) => t.quote.trim()),
          partnerLogos: v.partnerLogos,
          disclaimers: v.disclaimers,
        },
      });
      toast.success("Homepage saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Pages & homepage">
        <Button size="sm" onClick={save} disabled={saving}>
          Save changes
        </Button>
      </PageHeader>

      <div className="max-w-3xl space-y-4 p-5 lg:p-7">
        <SectionCard title="Hero">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Headline"
              value={v.hero.headline}
              onChange={(e) => set({ hero: { ...v.hero, headline: e.target.value } })}
            />
            <TextField
              label="Subhead"
              value={v.hero.subhead}
              onChange={(e) => set({ hero: { ...v.hero, subhead: e.target.value } })}
            />
            <TextField
              label="Primary CTA label"
              value={v.hero.ctaPrimaryLabel}
              onChange={(e) =>
                set({ hero: { ...v.hero, ctaPrimaryLabel: e.target.value } })
              }
            />
            <TextField
              label="Secondary CTA label"
              value={v.hero.ctaSecondaryLabel}
              onChange={(e) =>
                set({ hero: { ...v.hero, ctaSecondaryLabel: e.target.value } })
              }
            />
          </div>
          <ImagePicker
            label="Background image"
            value={v.hero.backgroundImage}
            onChange={(img) => set({ hero: { ...v.hero, backgroundImage: img } })}
            folder="homepage"
          />
        </SectionCard>

        <SectionCard
          title="Popular searches"
          description="Chips shown under the homepage hero."
        >
          {v.popularSearches.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <TextField
                label={i === 0 ? "Label" : undefined}
                wrapperClassName="flex-1"
                value={p.label}
                onChange={(e) => {
                  const next = [...v.popularSearches];
                  next[i] = { ...p, label: e.target.value };
                  set({ popularSearches: next });
                }}
              />
              <TextField
                label={i === 0 ? "Link" : undefined}
                wrapperClassName="flex-1"
                value={p.href}
                onChange={(e) => {
                  const next = [...v.popularSearches];
                  next[i] = { ...p, href: e.target.value };
                  set({ popularSearches: next });
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  set({
                    popularSearches: v.popularSearches.filter((_, idx) => idx !== i),
                  })
                }
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              set({
                popularSearches: [...v.popularSearches, { label: "", href: "" }],
              })
            }
          >
            <Plus className="size-4" />
            Add search
          </Button>
        </SectionCard>

        <SectionCard
          title="Featured clinics"
          description="Pinned on the homepage (separate from the Featured tier)."
        >
          <MultiSelect
            value={v.featuredClinicIds}
            onChange={(featuredClinicIds) => set({ featuredClinicIds })}
            options={clinicOptions.map((c) => ({ value: c.value, label: c.label }))}
            addLabel="Add clinic"
          />
        </SectionCard>

        <SectionCard title="Testimonials">
          {v.testimonials.map((t, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-text-secondary">
                  Testimonial {i + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set({
                      testimonials: v.testimonials.filter((_, idx) => idx !== i),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Quote"
                value={t.quote}
                onChange={(e) => {
                  const next = [...v.testimonials];
                  next[i] = { ...t, quote: e.target.value };
                  set({ testimonials: next });
                }}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Author"
                  value={t.author}
                  onChange={(e) => {
                    const next = [...v.testimonials];
                    next[i] = { ...t, author: e.target.value };
                    set({ testimonials: next });
                  }}
                />
                <Input
                  placeholder="Role"
                  value={t.role}
                  onChange={(e) => {
                    const next = [...v.testimonials];
                    next[i] = { ...t, role: e.target.value };
                    set({ testimonials: next });
                  }}
                />
                <Input
                  placeholder="Location"
                  value={t.location}
                  onChange={(e) => {
                    const next = [...v.testimonials];
                    next[i] = { ...t, location: e.target.value };
                    set({ testimonials: next });
                  }}
                />
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              set({
                testimonials: [
                  ...v.testimonials,
                  { quote: "", author: "", role: "", location: "" },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Add testimonial
          </Button>
        </SectionCard>

        <SectionCard
          title="Partner & accreditation logos"
          description="Shown in the homepage trust strip."
        >
          <GalleryField
            value={v.partnerLogos}
            onChange={(partnerLogos) => set({ partnerLogos })}
            folder="partners"
          />
        </SectionCard>

        <SectionCard
          title="Disclaimers"
          description="Medical/results/footer disclaimer copy (PRD §14)."
        >
          <TextareaField
            label="Medical disclaimer"
            rows={2}
            value={v.disclaimers.medical}
            onChange={(e) =>
              set({ disclaimers: { ...v.disclaimers, medical: e.target.value } })
            }
          />
          <TextareaField
            label="Results-vary note"
            rows={2}
            value={v.disclaimers.results}
            onChange={(e) =>
              set({ disclaimers: { ...v.disclaimers, results: e.target.value } })
            }
          />
          <TextareaField
            label="Footer disclaimer"
            rows={2}
            value={v.disclaimers.footer}
            onChange={(e) =>
              set({ disclaimers: { ...v.disclaimers, footer: e.target.value } })
            }
          />
        </SectionCard>
      </div>
    </>
  );
}

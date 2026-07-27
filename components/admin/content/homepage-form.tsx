"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import { ImagePicker } from "@/components/admin/image-picker";
import { MultiSelect } from "@/components/admin/multi-select";
import { TagInput } from "@/components/admin/tag-input";
import { Toggle } from "@/components/admin/toggle";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import {
  HOMEPAGE_DEFAULTS,
  HOMEPAGE_DISCLAIMERS,
  HOMEPAGE_ICONS,
} from "@/config/homepage";
import { TWITTER_CARD_TYPES, type TwitterCardType } from "@/lib/enums";
import type {
  HomepageFeedView,
  HomepageView,
} from "@/lib/admin/homepage";
import type { Option } from "@/lib/admin/lookups";

/** Google truncates around these; past them the counter turns amber, not invalid. */
const TITLE_SOFT_LIMIT = 60;
const DESCRIPTION_SOFT_LIMIT = 160;

const NAV: [string, string][] = [
  ["hero", "Hero"],
  ["popular", "Popular searches"],
  ["treatments", "Treatments"],
  ["conditions", "Conditions"],
  ["highlights", "Highlight cards"],
  ["destinations", "Destinations"],
  ["featured", "Featured clinics"],
  ["how", "How it works"],
  ["cost", "Cost & benefits"],
  ["trust", "Trust strip"],
  ["testimonials", "Testimonials"],
  ["for-clinics", "For clinics band"],
  ["faq", "FAQ"],
  ["blog", "Blog teaser"],
  ["seo", "SEO & meta"],
];

const ICON_OPTIONS = HOMEPAGE_ICONS.map((icon) => ({
  value: icon,
  label: icon.replace("-", " "),
}));

const DISCLAIMER_OPTIONS = HOMEPAGE_DISCLAIMERS.map((key) => ({
  value: key,
  label:
    key === "none"
      ? "No disclaimer"
      : key === "medical"
        ? "Medical (not advice)"
        : key === "results"
          ? "Results vary"
          : "Pricing is indicative",
}));

export function HomepageForm({
  view,
  clinicOptions,
}: {
  view: HomepageView;
  clinicOptions: Option[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState(view);
  const [active, setActive] = React.useState("hero");
  const [saving, setSaving] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(v) !== JSON.stringify(view),
    [v, view],
  );

  /** Merge a patch into one top-level object section. */
  function set<K extends keyof HomepageView>(
    key: K,
    patch: Partial<HomepageView[K]>,
  ) {
    setV(
      (c) =>
        ({
          ...c,
          [key]: { ...(c[key] as object), ...(patch as object) },
        }) as HomepageView,
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/homepage", {
        method: "PATCH",
        body: {
          // The overlay — everything that has no home of its own.
          homepage: {
            hero: {
              ctaPrimaryHref: v.hero.ctaPrimaryHref,
              ctaSecondaryHref: v.hero.ctaSecondaryHref,
              showSearch: v.hero.showSearch,
              popularLabel: v.hero.popularLabel,
            },
            treatments: v.treatments,
            conditions: v.conditions,
            highlights: {
              enabled: v.highlights.enabled,
              eyebrow: v.highlights.eyebrow,
              title: v.highlights.title,
              description: v.highlights.description,
              cards: v.highlights.cards.filter((c) => c.title && c.href),
            },
            destinations: v.destinations,
            featured: v.featured,
            howItWorks: {
              enabled: v.howItWorks.enabled,
              eyebrow: v.howItWorks.eyebrow,
              title: v.howItWorks.title,
              description: v.howItWorks.description,
              steps: v.howItWorks.steps.filter((s) => s.title),
            },
            costBenefits: {
              enabled: v.costBenefits.enabled,
              columns: v.costBenefits.columns.map((col) => ({
                ...col,
                bullets: col.bullets.filter((b) => b.trim()),
              })),
            },
            trust: v.trust,
            testimonials: {
              enabled: v.testimonials.enabled,
              eyebrow: v.testimonials.eyebrow,
              title: v.testimonials.title,
              description: v.testimonials.description,
              note: v.testimonials.note,
            },
            forClinics: v.forClinics,
            faq: {
              enabled: v.faq.enabled,
              heading: v.faq.heading,
              moreLabel: v.faq.moreLabel,
              moreHref: v.faq.moreHref,
              emitJsonLd: v.faq.emitJsonLd,
              items: v.faq.items.filter((f) => f.question && f.answer),
            },
            blog: v.blog,
            keywords: v.keywords,
          },
          // The four fields that predate the overlay keep their own storage.
          hero: {
            headline: v.hero.headline,
            subhead: v.hero.subhead,
            ctaPrimaryLabel: v.hero.ctaPrimaryLabel,
            ctaSecondaryLabel: v.hero.ctaSecondaryLabel,
            backgroundImage: v.hero.backgroundImage ?? null,
          },
          popularSearches: v.popularSearches.filter((p) => p.label && p.href),
          featuredClinicIds: v.featuredClinicIds,
          testimonials: v.testimonials.items
            .filter((t) => t.quote.trim())
            .map((t) => ({
              quote: t.quote,
              author: t.author || undefined,
              role: t.role || undefined,
              location: t.location || undefined,
              rating: t.rating,
            })),
          seo: {
            metaTitle: v.seo.metaTitle,
            metaDescription: v.seo.metaDescription,
            ogTitle: v.seo.ogTitle,
            ogDescription: v.seo.ogDescription,
            ogImage: v.seo.ogImage,
            canonicalUrl: v.seo.canonicalUrl,
            twitterCard: v.seo.twitterCard || undefined,
            focusKeyword: v.seo.focusKeyword,
            noindex: v.seo.noindex,
            robots: v.seo.follow === undefined ? undefined : { follow: v.seo.follow },
          },
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

  const d = HOMEPAGE_DEFAULTS;

  return (
    <>
      <PageHeader
        title="Homepage"
        breadcrumb={{ label: "Content", href: "/admin/content/pages" }}
        badge={
          dirty ? (
            <span className="rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-semibold text-warning-fg">
              Unsaved changes
            </span>
          ) : null
        }
        description="Every section, every string, and the page's meta."
      >
        <Button asChild size="sm" variant="ghost">
          <Link href="/" target="_blank" rel="noreferrer">
            View page
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          Save changes
        </Button>
      </PageHeader>

      <div className="flex items-start gap-6 p-5 lg:p-7">
        <nav className="sticky top-20 hidden w-44 flex-none lg:block">
          <div className="grid gap-0.5 text-[13.5px]">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActive(id)}
                className={cn(
                  "rounded-lg px-2.5 py-2",
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

        <div className="min-w-0 max-w-2xl flex-1 space-y-4">
          <p className="text-[13px] leading-relaxed text-text-muted">
            Leave a field blank to keep the copy that ships with the site, shown
            as placeholder text. Turning a section off hides it from the page
            without losing what you wrote.
          </p>

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <Panel id="hero" title="Hero">
            <TextField
              label="Headline"
              placeholder={d.hero.headline}
              value={v.hero.headline}
              onChange={(e) => set("hero", { headline: e.target.value })}
            />
            <TextareaField
              label="Subhead"
              rows={2}
              placeholder={d.hero.subhead}
              value={v.hero.subhead}
              onChange={(e) => set("hero", { subhead: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Primary CTA label"
                placeholder={d.hero.ctaPrimaryLabel}
                hint="Leave blank to hide the button."
                value={v.hero.ctaPrimaryLabel}
                onChange={(e) =>
                  set("hero", { ctaPrimaryLabel: e.target.value })
                }
              />
              <TextField
                label="Primary CTA link"
                placeholder={d.hero.ctaPrimaryHref}
                value={v.hero.ctaPrimaryHref}
                onChange={(e) => set("hero", { ctaPrimaryHref: e.target.value })}
              />
              <TextField
                label="Secondary CTA label"
                placeholder={d.hero.ctaSecondaryLabel}
                hint="Leave blank to hide the button."
                value={v.hero.ctaSecondaryLabel}
                onChange={(e) =>
                  set("hero", { ctaSecondaryLabel: e.target.value })
                }
              />
              <TextField
                label="Secondary CTA link"
                placeholder={d.hero.ctaSecondaryHref}
                value={v.hero.ctaSecondaryHref}
                onChange={(e) =>
                  set("hero", { ctaSecondaryHref: e.target.value })
                }
              />
            </div>
            <SwitchRow
              label="Search bar"
              description="The directory search field between the subhead and the buttons."
              checked={v.hero.showSearch}
              onCheckedChange={(showSearch) => set("hero", { showSearch })}
            />
            <ImagePicker
              label="Background image"
              hint="Optional. Replaces the default gradient; a light wash is applied over it for legibility."
              value={v.hero.backgroundImage}
              onChange={(backgroundImage) => set("hero", { backgroundImage })}
              folder="homepage"
            />
          </Panel>

          {/* ── Popular searches ─────────────────────────────────────── */}
          <Panel
            id="popular"
            title="Popular searches"
            description="Chips under the hero. Clear the list to hide the row."
          >
            <TextField
              label="Row label"
              placeholder={d.hero.popularLabel}
              value={v.hero.popularLabel}
              onChange={(e) => set("hero", { popularLabel: e.target.value })}
            />
            <Repeatable
              items={v.popularSearches}
              onChange={(popularSearches) => setV((c) => ({ ...c, popularSearches }))}
              addLabel="Add search"
              blank={{ label: "", href: "" }}
              renderItem={(item, update) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => update({ ...item, label: e.target.value })}
                  />
                  <Input
                    placeholder="/conditions/knee-osteoarthritis"
                    value={item.href}
                    onChange={(e) => update({ ...item, href: e.target.value })}
                  />
                </div>
              )}
            />
          </Panel>

          {/* ── Feed sections ────────────────────────────────────────── */}
          <FeedPanel
            id="treatments"
            title="Treatments grid"
            description="Cards pulled from the treatment taxonomy."
            value={v.treatments}
            defaults={d.treatments}
            onChange={(patch) => set("treatments", patch)}
          />

          <FeedPanel
            id="conditions"
            title="Conditions grid"
            description="Cards pulled from the condition taxonomy."
            value={v.conditions}
            defaults={d.conditions}
            onChange={(patch) => set("conditions", patch)}
          />

          {/* ── Highlight cards ──────────────────────────────────────── */}
          <Panel
            id="highlights"
            title="Highlight cards"
            description="The hand-written card row, the knee and joint cluster by default."
            enabled={v.highlights.enabled}
            onEnabledChange={(enabled) => set("highlights", { enabled })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Eyebrow"
                placeholder={d.highlights.eyebrow}
                value={v.highlights.eyebrow}
                onChange={(e) => set("highlights", { eyebrow: e.target.value })}
              />
              <TextField
                label="Title"
                placeholder={d.highlights.title}
                value={v.highlights.title}
                onChange={(e) => set("highlights", { title: e.target.value })}
              />
            </div>
            <TextareaField
              label="Description"
              rows={2}
              placeholder={d.highlights.description}
              value={v.highlights.description}
              onChange={(e) =>
                set("highlights", { description: e.target.value })
              }
            />
            <Repeatable
              items={v.highlights.cards}
              onChange={(cards) => set("highlights", { cards })}
              addLabel="Add card"
              blank={{ title: "", body: "", href: "" }}
              stacked
              renderItem={(item, update) => (
                <div className="grid flex-1 gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Card title"
                      value={item.title}
                      onChange={(e) => update({ ...item, title: e.target.value })}
                    />
                    <Input
                      placeholder="/conditions/knee-osteoarthritis"
                      value={item.href}
                      onChange={(e) => update({ ...item, href: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="One line about the card"
                    value={item.body}
                    onChange={(e) => update({ ...item, body: e.target.value })}
                  />
                </div>
              )}
            />
          </Panel>

          <FeedPanel
            id="destinations"
            title="Destinations grid"
            description="Country cards pulled from the location taxonomy."
            value={v.destinations}
            defaults={d.destinations}
            onChange={(patch) => set("destinations", patch)}
          />

          {/* ── Featured clinics ─────────────────────────────────────── */}
          <FeedPanel
            id="featured"
            title="Featured clinics"
            description="Curated clinics first; the rest of the row fills with the top-ranked."
            value={v.featured}
            defaults={d.featured}
            onChange={(patch) => set("featured", patch)}
          >
            <div className="space-y-1.5">
              <Label>Pinned clinics</Label>
              <MultiSelect
                value={v.featuredClinicIds}
                onChange={(featuredClinicIds) =>
                  setV((c) => ({ ...c, featuredClinicIds }))
                }
                options={clinicOptions.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
                addLabel="Add clinic"
              />
            </div>
          </FeedPanel>

          {/* ── How it works ─────────────────────────────────────────── */}
          <Panel
            id="how"
            title="How it works"
            enabled={v.howItWorks.enabled}
            onEnabledChange={(enabled) => set("howItWorks", { enabled })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Eyebrow"
                placeholder={d.howItWorks.eyebrow || "None"}
                value={v.howItWorks.eyebrow}
                onChange={(e) => set("howItWorks", { eyebrow: e.target.value })}
              />
              <TextField
                label="Title"
                placeholder={d.howItWorks.title}
                value={v.howItWorks.title}
                onChange={(e) => set("howItWorks", { title: e.target.value })}
              />
            </div>
            <TextareaField
              label="Description"
              rows={2}
              placeholder={d.howItWorks.description}
              value={v.howItWorks.description}
              onChange={(e) =>
                set("howItWorks", { description: e.target.value })
              }
            />
            <Repeatable
              items={v.howItWorks.steps}
              onChange={(steps) => set("howItWorks", { steps })}
              addLabel="Add step"
              blank={{ icon: "check", title: "", body: "" }}
              stacked
              label={(i) => `Step ${i + 1}`}
              renderItem={(item, update) => (
                <div className="grid flex-1 gap-2">
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                    <SelectField
                      options={ICON_OPTIONS}
                      value={item.icon}
                      onValueChange={(icon) => update({ ...item, icon })}
                    />
                    <Input
                      placeholder="Step title"
                      value={item.title}
                      onChange={(e) => update({ ...item, title: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="What happens at this step"
                    value={item.body}
                    onChange={(e) => update({ ...item, body: e.target.value })}
                  />
                </div>
              )}
            />
          </Panel>

          {/* ── Cost & benefits ──────────────────────────────────────── */}
          <Panel
            id="cost"
            title="Cost & benefits"
            description="The two-column block answering the questions most visitors arrive with."
            enabled={v.costBenefits.enabled}
            onEnabledChange={(enabled) => set("costBenefits", { enabled })}
          >
            {v.costBenefits.columns.map((col, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <span className="text-[13px] font-semibold text-text-secondary">
                  {i === 0 ? "Left column" : "Right column"}
                </span>
                <TextField
                  label="Heading"
                  value={col.title}
                  onChange={(e) =>
                    updateColumn(setV, i, { title: e.target.value })
                  }
                />
                <TextareaField
                  label="Opening paragraph"
                  rows={3}
                  value={col.intro}
                  onChange={(e) =>
                    updateColumn(setV, i, { intro: e.target.value })
                  }
                />
                <div className="space-y-1.5">
                  <Label>Bullets</Label>
                  <Repeatable
                    items={col.bullets}
                    onChange={(bullets) => updateColumn(setV, i, { bullets })}
                    addLabel="Add bullet"
                    blank=""
                    renderItem={(item, update) => (
                      <Input
                        className="flex-1"
                        placeholder="One point"
                        value={item}
                        onChange={(e) => update(e.target.value)}
                      />
                    )}
                  />
                </div>
                <TextareaField
                  label="Closing paragraph"
                  rows={3}
                  value={col.outro}
                  onChange={(e) =>
                    updateColumn(setV, i, { outro: e.target.value })
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Link label"
                    hint="Leave blank to hide the link."
                    value={col.ctaLabel}
                    onChange={(e) =>
                      updateColumn(setV, i, { ctaLabel: e.target.value })
                    }
                  />
                  <TextField
                    label="Link target"
                    value={col.ctaHref}
                    onChange={(e) =>
                      updateColumn(setV, i, { ctaHref: e.target.value })
                    }
                  />
                </div>
                <SelectField
                  label="Disclaimer"
                  options={DISCLAIMER_OPTIONS}
                  value={col.disclaimer}
                  onValueChange={(disclaimer) =>
                    updateColumn(setV, i, {
                      disclaimer: disclaimer as typeof col.disclaimer,
                    })
                  }
                />
              </div>
            ))}
          </Panel>

          {/* ── Trust strip ──────────────────────────────────────────── */}
          <Panel
            id="trust"
            title="Trust strip"
            enabled={v.trust.enabled}
            onEnabledChange={(enabled) => set("trust", { enabled })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Badge"
                placeholder={d.trust.badge}
                hint="Leave blank to hide the badge."
                value={v.trust.badge}
                onChange={(e) => set("trust", { badge: e.target.value })}
              />
              <TextField
                label="Heading"
                placeholder={d.trust.title}
                value={v.trust.title}
                onChange={(e) => set("trust", { title: e.target.value })}
              />
            </div>
            <TextareaField
              label="Body"
              rows={3}
              placeholder={d.trust.body}
              value={v.trust.body}
              onChange={(e) => set("trust", { body: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Link label"
                placeholder={d.trust.ctaLabel}
                value={v.trust.ctaLabel}
                onChange={(e) => set("trust", { ctaLabel: e.target.value })}
              />
              <TextField
                label="Link target"
                placeholder={d.trust.ctaHref}
                value={v.trust.ctaHref}
                onChange={(e) => set("trust", { ctaHref: e.target.value })}
              />
            </div>
            <SwitchRow
              label="Counters"
              description="Live clinic, verified, and review counts."
              checked={v.trust.showStats}
              onCheckedChange={(showStats) => set("trust", { showStats })}
            />
            {v.trust.showStats ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Clinics label"
                  placeholder={d.trust.clinicsLabel}
                  value={v.trust.clinicsLabel}
                  onChange={(e) =>
                    set("trust", { clinicsLabel: e.target.value })
                  }
                />
                <TextField
                  label="Verified label"
                  placeholder={d.trust.verifiedLabel}
                  value={v.trust.verifiedLabel}
                  onChange={(e) =>
                    set("trust", { verifiedLabel: e.target.value })
                  }
                />
                <TextField
                  label="Reviews label"
                  placeholder={d.trust.reviewsLabel}
                  value={v.trust.reviewsLabel}
                  onChange={(e) =>
                    set("trust", { reviewsLabel: e.target.value })
                  }
                />
              </div>
            ) : null}
          </Panel>

          {/* ── Testimonials ─────────────────────────────────────────── */}
          <Panel
            id="testimonials"
            title="Testimonials"
            description="The section is skipped entirely when there are no quotes."
            enabled={v.testimonials.enabled}
            onEnabledChange={(enabled) => set("testimonials", { enabled })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Eyebrow"
                placeholder={d.testimonials.eyebrow || "None"}
                value={v.testimonials.eyebrow}
                onChange={(e) =>
                  set("testimonials", { eyebrow: e.target.value })
                }
              />
              <TextField
                label="Title"
                placeholder={d.testimonials.title}
                value={v.testimonials.title}
                onChange={(e) => set("testimonials", { title: e.target.value })}
              />
            </div>
            <TextareaField
              label="Description"
              rows={2}
              placeholder={d.testimonials.description}
              value={v.testimonials.description}
              onChange={(e) =>
                set("testimonials", { description: e.target.value })
              }
            />
            <TextareaField
              label="Results-vary note"
              rows={2}
              hint="Printed under the quotes. Required by the compliance rules, so keep one."
              placeholder={d.testimonials.note}
              value={v.testimonials.note}
              onChange={(e) => set("testimonials", { note: e.target.value })}
            />
            <Repeatable
              items={v.testimonials.items}
              onChange={(items) => set("testimonials", { items })}
              addLabel="Add testimonial"
              blank={{ quote: "", author: "", role: "", location: "" }}
              stacked
              label={(i) => `Testimonial ${i + 1}`}
              renderItem={(item, update) => (
                <div className="grid flex-1 gap-2">
                  <TextareaField
                    rows={2}
                    placeholder="Quote"
                    value={item.quote}
                    onChange={(e) => update({ ...item, quote: e.target.value })}
                  />
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input
                      placeholder="Author"
                      value={item.author}
                      onChange={(e) =>
                        update({ ...item, author: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Role"
                      value={item.role}
                      onChange={(e) => update({ ...item, role: e.target.value })}
                    />
                    <Input
                      placeholder="Location"
                      value={item.location}
                      onChange={(e) =>
                        update({ ...item, location: e.target.value })
                      }
                    />
                    <SelectField
                      placeholder="Rating"
                      options={[
                        { value: "0", label: "No stars" },
                        ...[1, 2, 3, 4, 5].map((n) => ({
                          value: String(n),
                          label: `${n} star${n > 1 ? "s" : ""}`,
                        })),
                      ]}
                      value={String(item.rating ?? 0)}
                      onValueChange={(raw) =>
                        update({
                          ...item,
                          rating: Number(raw) || undefined,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            />
          </Panel>

          {/* ── For clinics band ─────────────────────────────────────── */}
          <Panel
            id="for-clinics"
            title="For clinics band"
            enabled={v.forClinics.enabled}
            onEnabledChange={(enabled) => set("forClinics", { enabled })}
          >
            <TextField
              label="Heading"
              placeholder={d.forClinics.title}
              value={v.forClinics.title}
              onChange={(e) => set("forClinics", { title: e.target.value })}
            />
            <TextareaField
              label="Body"
              rows={2}
              placeholder={d.forClinics.body}
              value={v.forClinics.body}
              onChange={(e) => set("forClinics", { body: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Button label"
                placeholder={d.forClinics.ctaLabel}
                value={v.forClinics.ctaLabel}
                onChange={(e) =>
                  set("forClinics", { ctaLabel: e.target.value })
                }
              />
              <TextField
                label="Button link"
                placeholder={d.forClinics.ctaHref}
                value={v.forClinics.ctaHref}
                onChange={(e) => set("forClinics", { ctaHref: e.target.value })}
              />
            </div>
          </Panel>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <Panel
            id="faq"
            title="FAQ"
            description="Also the source of the page's FAQPage structured data, which is what lets answer engines quote it."
            enabled={v.faq.enabled}
            onEnabledChange={(enabled) => set("faq", { enabled })}
          >
            <TextField
              label="Heading"
              placeholder={d.faq.heading}
              value={v.faq.heading}
              onChange={(e) => set("faq", { heading: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Footer link label"
                placeholder={d.faq.moreLabel}
                value={v.faq.moreLabel}
                onChange={(e) => set("faq", { moreLabel: e.target.value })}
              />
              <TextField
                label="Footer link target"
                placeholder={d.faq.moreHref}
                value={v.faq.moreHref}
                onChange={(e) => set("faq", { moreHref: e.target.value })}
              />
            </div>
            <SwitchRow
              label="FAQPage structured data"
              description="Emit the questions below as JSON-LD."
              checked={v.faq.emitJsonLd}
              onCheckedChange={(emitJsonLd) => set("faq", { emitJsonLd })}
            />
            <Repeatable
              items={v.faq.items}
              onChange={(items) => set("faq", { items })}
              addLabel="Add question"
              blank={{ question: "", answer: "" }}
              stacked
              label={(i) => `Question ${i + 1}`}
              renderItem={(item, update) => (
                <div className="grid flex-1 gap-2">
                  <Input
                    placeholder="Question"
                    value={item.question}
                    onChange={(e) =>
                      update({ ...item, question: e.target.value })
                    }
                  />
                  <TextareaField
                    rows={3}
                    placeholder="Answer the question in the first sentence, then add the detail."
                    value={item.answer}
                    onChange={(e) => update({ ...item, answer: e.target.value })}
                  />
                </div>
              )}
            />
          </Panel>

          {/* ── Blog teaser ──────────────────────────────────────────── */}
          <FeedPanel
            id="blog"
            title="Blog teaser"
            description="The latest published posts."
            value={v.blog}
            defaults={d.blog}
            onChange={(patch) => set("blog", patch)}
          />

          {/* ── SEO & meta ───────────────────────────────────────────── */}
          <Panel
            id="seo"
            title="SEO & meta"
            description="Shared with the Page SEO screen. The homepage has one title tag, edited from either place."
          >
            <TextField
              label="Meta title"
              placeholder={v.seoPlaceholders.title}
              hint="Used verbatim, brand suffix included. No em dashes, and | is the only separator."
              labelAccessory={
                <Counter value={v.seo.metaTitle} limit={TITLE_SOFT_LIMIT} />
              }
              value={v.seo.metaTitle}
              onChange={(e) => set("seo", { metaTitle: e.target.value })}
            />
            <TextareaField
              label="Meta description"
              rows={3}
              placeholder={v.seoPlaceholders.description}
              labelAccessory={
                <Counter
                  value={v.seo.metaDescription}
                  limit={DESCRIPTION_SOFT_LIMIT}
                />
              }
              value={v.seo.metaDescription}
              onChange={(e) => set("seo", { metaDescription: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="OG title"
                hint="Falls back to the meta title."
                value={v.seo.ogTitle}
                onChange={(e) => set("seo", { ogTitle: e.target.value })}
              />
              <TextField
                label="OG image URL"
                hint="Falls back to the site default."
                value={v.seo.ogImage}
                onChange={(e) => set("seo", { ogImage: e.target.value })}
              />
            </div>
            <TextareaField
              label="OG description"
              rows={2}
              hint="Falls back to the meta description."
              value={v.seo.ogDescription}
              onChange={(e) => set("seo", { ogDescription: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Canonical URL"
                hint="Full URL. Blank means the page's own address."
                value={v.seo.canonicalUrl}
                onChange={(e) => set("seo", { canonicalUrl: e.target.value })}
              />
              <SelectField
                label="Twitter card"
                options={[
                  // A Radix select item can't carry an empty value, so
                  // "inherit" stands in for "nothing stored".
                  { value: "inherit", label: "Site default" },
                  ...TWITTER_CARD_TYPES.map((t) => ({ value: t, label: t })),
                ]}
                value={v.seo.twitterCard || "inherit"}
                onValueChange={(raw) =>
                  set("seo", {
                    twitterCard:
                      raw === "inherit"
                        ? ""
                        : (raw as TwitterCardType),
                  })
                }
              />
            </div>
            <TextField
              label="Focus keyword"
              hint="Editorial only. Never emitted."
              value={v.seo.focusKeyword}
              onChange={(e) => set("seo", { focusKeyword: e.target.value })}
            />
            <div className="space-y-1.5">
              <Label>Meta keywords</Label>
              <TagInput
                value={v.keywords}
                onChange={(keywords) => setV((c) => ({ ...c, keywords }))}
                placeholder="Add a keyword and press Enter"
              />
            </div>
            <SwitchRow
              label="Hide from search engines"
              description="Adds noindex. The homepage should almost never have this on."
              checked={v.seo.noindex}
              onCheckedChange={(noindex) => set("seo", { noindex })}
            />
            <SelectField
              label="Link following"
              options={[
                { value: "inherit", label: "Inherit (follow)" },
                { value: "follow", label: "Follow" },
                { value: "nofollow", label: "Nofollow" },
              ]}
              value={
                v.seo.follow === undefined
                  ? "inherit"
                  : v.seo.follow
                    ? "follow"
                    : "nofollow"
              }
              onValueChange={(raw) =>
                set("seo", {
                  follow: raw === "inherit" ? undefined : raw === "follow",
                })
              }
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Replace one cost/benefits column without disturbing the other. */
function updateColumn(
  setV: React.Dispatch<React.SetStateAction<HomepageView>>,
  index: number,
  patch: Partial<HomepageView["costBenefits"]["columns"][number]>,
) {
  setV((c) => ({
    ...c,
    costBenefits: {
      ...c.costBenefits,
      columns: c.costBenefits.columns.map((col, i) =>
        i === index ? { ...col, ...patch } : col,
      ),
    },
  }));
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Panel({
  id,
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** Omit for a section that can't be switched off (the hero, the meta block). */
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  const off = enabled === false;
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-text-primary">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[13px] text-text-muted">{description}</p>
          ) : null}
        </div>
        {onEnabledChange ? (
          <div className="flex flex-none items-center gap-2">
            <span className="text-[12.5px] text-text-muted">
              {off ? "Hidden" : "Visible"}
            </span>
            <Toggle
              checked={Boolean(enabled)}
              onCheckedChange={onEnabledChange}
              label={`Show ${title}`}
            />
          </div>
        ) : null}
      </div>
      <div className={cn("mt-4 space-y-4", off && "opacity-50")}>{children}</div>
    </section>
  );
}

/** One of the five sections whose grid comes from the database. */
function FeedPanel({
  id,
  title,
  description,
  value,
  defaults,
  onChange,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  value: HomepageFeedView;
  defaults: (typeof HOMEPAGE_DEFAULTS)["treatments"];
  onChange: (patch: Partial<HomepageFeedView>) => void;
  children?: React.ReactNode;
}) {
  return (
    <Panel
      id={id}
      title={title}
      description={description}
      enabled={value.enabled}
      onEnabledChange={(enabled) => onChange({ enabled })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Eyebrow"
          placeholder={defaults.eyebrow || "None"}
          value={value.eyebrow}
          onChange={(e) => onChange({ eyebrow: e.target.value })}
        />
        <TextField
          label="Title"
          placeholder={defaults.title}
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <TextareaField
        label="Description"
        rows={2}
        placeholder={defaults.description}
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
        <TextField
          label="Link label"
          placeholder={defaults.linkLabel || "None"}
          hint="Blank hides the link."
          value={value.linkLabel}
          onChange={(e) => onChange({ linkLabel: e.target.value })}
        />
        <TextField
          label="Link target"
          placeholder={defaults.linkHref}
          value={value.linkHref}
          onChange={(e) => onChange({ linkHref: e.target.value })}
        />
        <TextField
          label="Items"
          type="number"
          min={1}
          max={24}
          value={value.limit}
          onChange={(e) =>
            onChange({ limit: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </div>
      {children}
    </Panel>
  );
}

/**
 * An ordered, editable list: each row renders through `renderItem` and carries
 * move/remove controls. Order matters on this page — it's the order the cards,
 * steps and questions appear in — so reordering is part of the editor rather
 * than something you fake by retyping rows.
 */
function Repeatable<T>({
  items,
  onChange,
  renderItem,
  blank,
  addLabel,
  label,
  stacked,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (next: T) => void) => React.ReactNode;
  /** A fresh item for the Add button. */
  blank: T;
  addLabel: string;
  /** Row caption, e.g. `Step 1`. Only rendered in `stacked` rows. */
  label?: (index: number) => string;
  /** Boxed rows for multi-field items; inline for single-line ones. */
  stacked?: boolean;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as T);
    onChange(next);
  };
  const update = (index: number) => (item: T) =>
    onChange(items.map((existing, i) => (i === index ? item : existing)));

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2",
            stacked && "rounded-lg border border-border p-3",
          )}
        >
          <div className="min-w-0 flex-1 space-y-2">
            {stacked && label ? (
              <span className="text-[12.5px] font-semibold text-text-secondary">
                {label(i)}
              </span>
            ) : null}
            {renderItem(item, update(i))}
          </div>
          <div className="flex flex-none flex-col">
            <Button
              variant="ghost"
              size="icon"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              aria-label="Move up"
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={i === items.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label="Move down"
            >
              <ChevronDown className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label="Remove"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange([
              ...items,
              typeof blank === "object" && blank !== null
                ? ({ ...blank } as T)
                : blank,
            ])
          }
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
        {items.length ? (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            <RotateCcw className="size-4" />
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description ? (
          <div className="text-[12.5px] text-text-muted">{description}</div>
        ) : null}
      </div>
      <Toggle
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={label}
      />
    </div>
  );
}

function Counter({ value, limit }: { value: string; limit: number }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "text-[12px] tabular-nums",
        value.length > limit ? "text-warning-fg" : "text-text-muted",
      )}
    >
      {value.length}/{limit}
    </span>
  );
}

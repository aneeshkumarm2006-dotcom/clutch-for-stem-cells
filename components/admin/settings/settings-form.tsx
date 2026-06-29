"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import type { SettingsView } from "@/lib/admin/settings";

const WEIGHTS: [keyof SettingsView["rankingWeights"], string][] = [
  ["rating", "Review quality"],
  ["reviewVolume", "Review volume"],
  ["recency", "Recency boost"],
  ["completeness", "Profile completeness"],
  ["accreditation", "Accreditation score"],
  ["tier", "Tier boost"],
];

const FLAGS: [string, string, string][] = [
  ["enableCompare", "Compare clinics", "Side-by-side comparison from the shortlist"],
  ["enableProviderSelfServe", "Provider self-serve", "Let clinics claim and submit profiles"],
  ["enableShortlist", "Shortlist", "Save clinics to a shortlist"],
  ["enableResources", "Resources hub", "Education hub / blog"],
  ["enableMatchingWizard", "Matching wizard", "Find-a-clinic guided stepper"],
  ["enableBilling", "Billing", "Live Stripe billing for tiers"],
  ["enableSavedSearches", "Saved searches", "Save searches with alerts"],
  ["enableDarkMode", "Dark mode", "Theme toggle"],
];

const NAV = [
  ["ranking", "Ranking weights"],
  ["seo", "SEO defaults"],
  ["contact", "Contact & social"],
  ["analytics", "Analytics"],
  ["flags", "Feature flags"],
] as const;

export function SettingsForm({ settings }: { settings: SettingsView }) {
  const router = useRouter();
  const [v, setV] = React.useState(settings);
  const [active, setActive] = React.useState("ranking");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: {
          rankingWeights: v.rankingWeights,
          seoDefaults: v.seoDefaults,
          contact: v.contact,
          social: v.social,
          analytics: v.analytics,
          featureFlags: v.featureFlags,
        },
      });
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings">
        <Button size="sm" onClick={save} disabled={saving}>
          Save settings
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
          <Section id="ranking" title="Ranking weights" description="Tune the Recommended sort. Explained publicly on /methodology.">
            <div className="space-y-4">
              {WEIGHTS.map(([key, label]) => (
                <div key={key}>
                  <div className="mb-1.5 flex justify-between text-[13.5px]">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="font-display font-bold text-azure-700">
                      {v.rankingWeights[key].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={v.rankingWeights[key]}
                    onChange={(e) =>
                      setV((c) => ({
                        ...c,
                        rankingWeights: {
                          ...c.rankingWeights,
                          [key]: Number(e.target.value),
                        },
                      }))
                    }
                    className="h-1.5 w-full accent-primary"
                  />
                </div>
              ))}
              <p className="text-[12.5px] text-text-muted">
                Saving recomputes all clinic ranking scores.
              </p>
            </div>
          </Section>

          <Section id="seo" title="SEO defaults">
            <TextField
              label="Title template"
              placeholder="%s · StemConnect"
              value={v.seoDefaults.titleTemplate}
              onChange={(e) =>
                setV((c) => ({
                  ...c,
                  seoDefaults: { ...c.seoDefaults, titleTemplate: e.target.value },
                }))
              }
            />
            <TextField
              label="Default meta description"
              value={v.seoDefaults.metaDescription}
              onChange={(e) =>
                setV((c) => ({
                  ...c,
                  seoDefaults: {
                    ...c.seoDefaults,
                    metaDescription: e.target.value,
                  },
                }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Default OG image"
                value={v.seoDefaults.ogImage}
                onChange={(e) =>
                  setV((c) => ({
                    ...c,
                    seoDefaults: { ...c.seoDefaults, ogImage: e.target.value },
                  }))
                }
              />
              <TextField
                label="Twitter handle"
                value={v.seoDefaults.twitterHandle}
                onChange={(e) =>
                  setV((c) => ({
                    ...c,
                    seoDefaults: {
                      ...c.seoDefaults,
                      twitterHandle: e.target.value,
                    },
                  }))
                }
              />
            </div>
          </Section>

          <Section id="contact" title="Contact & social">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Contact email"
                value={v.contact.email}
                onChange={(e) =>
                  setV((c) => ({ ...c, contact: { ...c.contact, email: e.target.value } }))
                }
              />
              <TextField
                label="Phone"
                value={v.contact.phone}
                onChange={(e) =>
                  setV((c) => ({ ...c, contact: { ...c.contact, phone: e.target.value } }))
                }
              />
              <TextField
                label="Address"
                wrapperClassName="sm:col-span-2"
                value={v.contact.address}
                onChange={(e) =>
                  setV((c) => ({
                    ...c,
                    contact: { ...c.contact, address: e.target.value },
                  }))
                }
              />
              <TextField
                label="LinkedIn"
                value={v.social.linkedin}
                onChange={(e) =>
                  setV((c) => ({ ...c, social: { ...c.social, linkedin: e.target.value } }))
                }
              />
              <TextField
                label="Instagram"
                value={v.social.instagram}
                onChange={(e) =>
                  setV((c) => ({ ...c, social: { ...c.social, instagram: e.target.value } }))
                }
              />
              <TextField
                label="Facebook"
                value={v.social.facebook}
                onChange={(e) =>
                  setV((c) => ({ ...c, social: { ...c.social, facebook: e.target.value } }))
                }
              />
              <TextField
                label="X (Twitter)"
                value={v.social.x}
                onChange={(e) =>
                  setV((c) => ({ ...c, social: { ...c.social, x: e.target.value } }))
                }
              />
            </div>
          </Section>

          <Section id="analytics" title="Analytics">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="GA4 ID"
                value={v.analytics.ga4Id}
                onChange={(e) =>
                  setV((c) => ({ ...c, analytics: { ...c.analytics, ga4Id: e.target.value } }))
                }
              />
              <TextField
                label="Plausible domain"
                value={v.analytics.plausibleDomain}
                onChange={(e) =>
                  setV((c) => ({
                    ...c,
                    analytics: { ...c.analytics, plausibleDomain: e.target.value },
                  }))
                }
              />
              <TextField
                label="PostHog key"
                value={v.analytics.posthogKey}
                onChange={(e) =>
                  setV((c) => ({
                    ...c,
                    analytics: { ...c.analytics, posthogKey: e.target.value },
                  }))
                }
              />
            </div>
          </Section>

          <Section id="flags" title="Feature flags">
            <div className="grid gap-0.5">
              {FLAGS.map(([key, label, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {label}
                    </div>
                    <div className="text-[12.5px] text-text-muted">{desc}</div>
                  </div>
                  <Toggle
                    checked={Boolean(v.featureFlags[key])}
                    onCheckedChange={(on) =>
                      setV((c) => ({
                        ...c,
                        featureFlags: { ...c.featureFlags, [key]: on },
                      }))
                    }
                    label={label}
                  />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

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
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

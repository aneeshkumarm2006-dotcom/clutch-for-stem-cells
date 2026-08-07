"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/form-field";
import { GalleryField } from "@/components/admin/image-picker";
import { adminFetch } from "@/lib/admin/client";
import type { SettingsView } from "@/lib/admin/settings";

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

/**
 * Site-wide content that isn't tied to one page: the partner logo strip and the
 * disclaimer copy reused across profiles, reviews and the wizard.
 *
 * The homepage panels that used to live here (hero, popular searches, featured
 * clinics, testimonials) moved to `/admin/content/homepage`, where they sit
 * alongside the rest of the landing page rather than being split across two
 * screens. Their storage is unchanged.
 */
export function PagesForm({ settings }: { settings: SettingsView }) {
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
          partnerLogos: v.partnerLogos,
          disclaimers: v.disclaimers,
        },
      });
      toast.success("Site content saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Shared content"
        description="Content reused across pages rather than owned by one. Individual pages are edited in Site pages."
      >
        <Button size="sm" onClick={save} disabled={saving}>
          Save changes
        </Button>
      </PageHeader>

      <div className="max-w-3xl space-y-4 p-5 lg:p-7">
        <SectionCard
          title="Homepage"
          description="The hero, popular searches, featured clinics, testimonials, every section and the page's meta are edited together."
        >
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/content/homepage">
              Open the homepage editor
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </SectionCard>

        <SectionCard
          title="Every other page"
          description="About, methodology, FAQ, contact, the legal pages, the directory hubs: headline, intro, and body for each."
        >
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/content/site-pages">
              Open site pages
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </SectionCard>

        <SectionCard
          title="Partner & accreditation logos"
          description="Shown in the trust strip."
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

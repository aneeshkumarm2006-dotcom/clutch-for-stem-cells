/**
 * Page-SEO read layer — powers `/admin/seo`.
 *
 * Joins the shipped copy in `config/static-pages.ts` with whatever override is
 * stored in `SiteSetting.pageSeo`, so the admin list shows, per route, both the
 * value that ships in code and the value that is actually live. Fixed routes are
 * the only thing this manages; record-backed pages (clinics, taxonomy terms,
 * blog posts, clinic landings) each carry their own `seo` sub-document and are
 * surfaced as pointers to the screen that owns them.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { SiteSetting } from "@/models";
import {
  STATIC_PAGES,
  normalizePagePath,
  type StaticPageGroup,
} from "@/config/static-pages";

export interface PageSeoRow {
  path: string;
  label: string;
  group: StaticPageGroup;
  /** The copy that ships in code — shown as the input placeholder. */
  defaultTitle: string;
  defaultDescription: string;
  /** Stored overrides ("" when unset). */
  metaTitle: string;
  metaDescription: string;
  noindex: boolean;
}

/** Where the metadata for each record-backed content type is actually edited. */
export interface PageSeoPointer {
  label: string;
  description: string;
  href: string;
}

export const PAGE_SEO_POINTERS: PageSeoPointer[] = [
  {
    label: "Treatment pages",
    description: "/treatments/… — meta title & description per treatment term.",
    href: "/admin/taxonomy/treatments",
  },
  {
    label: "Condition pages",
    description: "/conditions/… — meta title & description per condition term.",
    href: "/admin/taxonomy/conditions",
  },
  {
    label: "Destination pages",
    description: "/locations/… — meta title & description per country and city.",
    href: "/admin/taxonomy/locations",
  },
  {
    label: "Clinic landing pages",
    description: "/clinics/… — curated location & treatment landing pages.",
    href: "/admin/content/clinic-landings",
  },
  {
    label: "Clinic profiles",
    description: "/clinic/… — the SEO panel on each clinic record.",
    href: "/admin/clinics",
  },
  {
    label: "Composed pages",
    description: "Editor-built block pages, including nested paths.",
    href: "/admin/content/pages",
  },
];

export async function getPageSeoRows(): Promise<PageSeoRow[]> {
  await dbConnect();
  const settings = await SiteSetting.getGlobal();

  const stored = new Map(
    (settings.pageSeo ?? [])
      .filter((entry) => entry?.path)
      .map((entry) => [normalizePagePath(entry.path), entry]),
  );

  return STATIC_PAGES.map((page) => {
    const override = stored.get(page.path);
    return {
      path: page.path,
      label: page.label,
      group: page.group,
      defaultTitle: page.title,
      defaultDescription: page.description,
      metaTitle: override?.metaTitle ?? "",
      metaDescription: override?.metaDescription ?? "",
      noindex: Boolean(override?.noindex),
    };
  });
}

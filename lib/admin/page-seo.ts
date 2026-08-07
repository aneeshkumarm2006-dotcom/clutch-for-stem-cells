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
import { SiteSetting, toPlainObject, type IPageSeoOverride } from "@/models";
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
    label: "Homepage OG, canonical & keywords",
    description:
      "The title and description below are the homepage's; the rest of its meta is edited with its content.",
    href: "/admin/content/homepage#seo",
  },
  {
    label: "Treatment pages",
    description: "/treatments/…: meta title & description per treatment term.",
    href: "/admin/taxonomy/treatments",
  },
  {
    label: "Condition pages",
    description: "/conditions/…: meta title & description per condition term.",
    href: "/admin/taxonomy/conditions",
  },
  {
    label: "Destination pages",
    description: "/locations/…: meta title & description per country and city.",
    href: "/admin/taxonomy/locations",
  },
  {
    label: "Clinic landing pages",
    description: "/clinics/…: curated location & treatment landing pages.",
    href: "/admin/content/clinic-landings",
  },
  {
    label: "Clinic profiles",
    description: "/clinic/…: the SEO panel on each clinic record.",
    href: "/admin/clinics",
  },
  {
    label: "Composed pages",
    description: "Editor-built block pages, including nested paths.",
    href: "/admin/content/pages",
  },
];

// ── Single-row writes ───────────────────────────────────────────────────────
//
// `/admin/seo` posts the whole list and replaces it wholesale. Every other
// screen that owns one route's meta — the homepage editor, the site-page
// editors — has to touch only its own row and carry the rest through
// untouched. These two helpers are that operation.

/** True once an override carries something worth storing. */
export function hasSeoValue(seo: Record<string, unknown>): boolean {
  return Object.entries(seo).some(([key, value]) => {
    if (value === undefined || value === "") return false;
    if (key === "path") return false;
    if (key === "noindex") return value === true;
    if (key === "robots" && value && typeof value === "object") {
      return Object.values(value).some((v) => v !== undefined);
    }
    return true;
  });
}

/**
 * The `pageSeo` list with `path`'s row replaced by `seo`. Pass `null` (or an
 * override with nothing set) to drop the row instead of storing an empty
 * document — a cleared form is a deletion, not a blank override.
 */
export function withPageSeoRow(
  list: IPageSeoOverride[] | undefined,
  path: string,
  seo: Record<string, unknown> | null,
): Record<string, unknown>[] {
  const key = normalizePagePath(path);
  const others = (list ?? [])
    .filter((row) => row?.path && normalizePagePath(row.path) !== key)
    .map((row) => toPlainObject(row) as Record<string, unknown>);

  if (!seo || !hasSeoValue(seo)) return others;
  return [...others, { ...seo, path: key }];
}

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

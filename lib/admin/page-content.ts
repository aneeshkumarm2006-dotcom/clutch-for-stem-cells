/**
 * Page-content admin read layer — powers `/admin/content/site-pages`.
 *
 * Two reads. The index needs to know, per route, whether anything is
 * overridden and when it last changed; the editor needs the resolved values
 * plus the shipped ones, so the form can show the default as placeholder text
 * and an editor always sees the live value rather than a copy that can drift.
 *
 * Both joins pull in the route's meta as well. A fixed page's copy lives on a
 * `PageContent` document and its meta lives in `SiteSetting.pageSeo`, but an
 * editor thinks of them as one page, so the editor screen edits both and this
 * layer is where the two stores are stitched back together.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { resolvePageContent, type ResolvedPageContent } from "@/lib/page-content";
import {
  EDITABLE_PAGES,
  editablePage,
  pageDefaults,
  type EditablePage,
  type EditablePageDefaults,
} from "@/config/editable-pages";
import { normalizePagePath, staticPageMeta } from "@/config/static-pages";
import {
  PageContent,
  SiteSetting,
  toPlainObject,
  type IPageSeoOverride,
} from "@/models";

/** The meta fields the site-page editor exposes, flattened for a form. */
export interface PageSeoView {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonicalUrl: string;
  twitterCard: string;
  focusKeyword: string;
  noindex: boolean;
  /** `undefined` means "inherit"; `robots.follow` is the stored form. */
  follow: boolean | undefined;
}

export const EMPTY_PAGE_SEO: PageSeoView = {
  metaTitle: "",
  metaDescription: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  canonicalUrl: "",
  twitterCard: "",
  focusKeyword: "",
  noindex: false,
  follow: undefined,
};

function toSeoView(override: IPageSeoOverride | undefined): PageSeoView {
  if (!override) return EMPTY_PAGE_SEO;
  const seo = toPlainObject(override) as Record<string, unknown>;
  const str = (key: string) =>
    typeof seo[key] === "string" ? (seo[key] as string) : "";
  const robots = seo.robots as { follow?: boolean } | undefined;
  return {
    metaTitle: str("metaTitle"),
    metaDescription: str("metaDescription"),
    ogTitle: str("ogTitle"),
    ogDescription: str("ogDescription"),
    ogImage: str("ogImage"),
    canonicalUrl: str("canonicalUrl"),
    twitterCard: str("twitterCard"),
    focusKeyword: str("focusKeyword"),
    noindex: seo.noindex === true,
    follow: typeof robots?.follow === "boolean" ? robots.follow : undefined,
  };
}

/**
 * True once any meta field on this route is set. `noindex: false` and an
 * absent `follow` are the inherited defaults, so neither counts as an edit.
 */
function isSeoCustomized(seo: PageSeoView): boolean {
  return Object.entries(seo).some(([key, value]) => {
    if (key === "noindex") return value === true;
    if (key === "follow") return typeof value === "boolean";
    return typeof value === "string" && value.trim().length > 0;
  });
}

/** Every stored override, keyed by normalized path. */
async function pageSeoByPath(): Promise<Map<string, IPageSeoOverride>> {
  const settings = await SiteSetting.getGlobal();
  return new Map(
    (settings.pageSeo ?? [])
      .filter((row) => row?.path)
      .map((row) => [normalizePagePath(row.path), row]),
  );
}

export interface PageContentRow {
  path: string;
  label: string;
  group: string;
  variantOf?: string;
  variantWhen?: string;
  /** The live H1, override applied. */
  title: string;
  /** True once anything on this route is overridden. */
  customized: boolean;
  /** True once this route's meta title/description/robots are overridden. */
  seoCustomized: boolean;
  updatedAt: Date | null;
}

/** Which stored fields count as "the editor changed something". */
function isCustomized(doc: {
  title?: string;
  lead?: string;
  updated?: string;
  legalReview?: boolean | null;
  blocks?: unknown[];
  blocksAfter?: unknown[];
  extras?: Record<string, string> | Map<string, string>;
}): boolean {
  const extras =
    doc.extras instanceof Map
      ? Object.fromEntries(doc.extras)
      : (doc.extras ?? {});
  return Boolean(
    doc.title?.trim() ||
      doc.lead?.trim() ||
      doc.updated?.trim() ||
      typeof doc.legalReview === "boolean" ||
      doc.blocks?.length ||
      doc.blocksAfter?.length ||
      Object.values(extras).some((v) => v?.trim()),
  );
}

/** Every editable route, in registry order, with its override state. */
export async function getPageContentRows(): Promise<PageContentRow[]> {
  await dbConnect();
  const [docs, seoByPath] = await Promise.all([
    PageContent.find({}).lean(),
    pageSeoByPath(),
  ]);
  const byPath = new Map(docs.map((d) => [d.path, d]));

  return EDITABLE_PAGES.map((entry) => {
    const doc = byPath.get(entry.path);
    const resolved = resolvePageContent(entry.path, doc ?? null);
    return {
      path: entry.path,
      label: entry.label,
      group: entry.group,
      variantOf: entry.variantOf,
      variantWhen: entry.variantWhen,
      title: resolved.title,
      customized: doc ? isCustomized(doc) : false,
      seoCustomized: isSeoCustomized(toSeoView(seoByPath.get(entry.path))),
      updatedAt: (doc?.updatedAt as Date | undefined) ?? null,
    };
  });
}

export interface PageContentEditorData {
  entry: EditablePage;
  /** What renders today. */
  resolved: ResolvedPageContent;
  /** The shipped copy, for placeholders and the reset action. */
  defaults: EditablePageDefaults;
  /** The raw stored overrides, so a blank field stays visibly blank. */
  stored: {
    title: string;
    lead: string;
    updated: string;
    legalReview: boolean | null;
    blocks: ResolvedPageContent["blocks"];
    blocksAfter: ResolvedPageContent["blocksAfter"];
    extras: Record<string, string>;
  };
  /**
   * The route's meta. `null` for a variant, which renders under its parent's
   * URL and therefore has no title tag of its own to edit.
   */
  seo: {
    stored: PageSeoView;
    /** Shipped title/description from `config/static-pages.ts`, for placeholders. */
    defaults: { title: string; description: string };
  } | null;
}

/** Everything the editor screen needs for one route, or `null` if unknown. */
export async function getPageContentEditorData(
  path: string,
): Promise<PageContentEditorData | null> {
  const entry = editablePage(path);
  if (!entry) return null;

  await dbConnect();
  const doc = await PageContent.findOne({ path }).lean();
  const defaults = pageDefaults(path);
  const resolved = resolvePageContent(path, doc ?? null);

  const storedExtras =
    doc?.extras instanceof Map
      ? Object.fromEntries(doc.extras)
      : ((doc?.extras ?? {}) as Record<string, string>);

  // A route only has editable meta if `config/static-pages.ts` registers it —
  // that registry is what `pageMetadata` reads the override back through, so an
  // unregistered path would take edits nothing would ever render.
  const shipped = entry.variantOf ? undefined : staticPageMeta(path);
  const seo = shipped
    ? {
        stored: toSeoView((await pageSeoByPath()).get(path)),
        defaults: {
          title: shipped.title,
          description: shipped.description,
        },
      }
    : null;

  return {
    entry,
    resolved,
    defaults,
    seo,
    stored: {
      title: doc?.title ?? "",
      lead: doc?.lead ?? "",
      updated: doc?.updated ?? "",
      legalReview:
        typeof doc?.legalReview === "boolean" ? doc.legalReview : null,
      // Stored blocks are shown as-is when present. When nothing is stored the
      // editor starts from the shipped composition, so the first edit is a
      // tweak to real content rather than authoring a page from an empty list.
      blocks: doc?.blocks?.length ? resolved.blocks : defaults.blocks,
      blocksAfter: doc?.blocksAfter?.length
        ? resolved.blocksAfter
        : defaults.blocksAfter,
      extras: Object.fromEntries(
        entry.extras.map((e) => [e.key, storedExtras[e.key] ?? ""]),
      ),
    },
  };
}

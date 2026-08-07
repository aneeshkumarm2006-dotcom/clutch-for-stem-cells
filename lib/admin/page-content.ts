/**
 * Page-content admin read layer — powers `/admin/content/site-pages`.
 *
 * Two reads. The index needs to know, per route, whether anything is
 * overridden and when it last changed; the editor needs the resolved values
 * plus the shipped ones, so the form can show the default as placeholder text
 * and an editor always sees the live value rather than a copy that can drift.
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
import { PageContent } from "@/models";

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
  const docs = await PageContent.find({}).lean();
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

  return {
    entry,
    resolved,
    defaults,
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

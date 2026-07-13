/**
 * Schema preview — builds the JSON-LD for an *unsaved* editor draft.
 *
 * The admin schema panel needs to show what a record *would* emit as the editor
 * types, before anything is persisted. Rather than duplicating the engine in the
 * browser (which would inevitably drift), the client posts its current form
 * values here and the server runs the same `previewJsonLd` the live page uses —
 * one source of truth for what the page will actually emit.
 *
 * The mapper below is the only place that knows how a given editor's form shape
 * maps onto its adapter input. Adding a schema panel to a new editor means
 * adding one case here.
 */
import "server-only";
import { z } from "zod";

import { CONTENT_TYPE_KEYS, type ContentTypeKey } from "@/config/content-engine";
import { previewJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import { schemaOverrideSchema } from "@/lib/validation/common";
import { blocksSchema } from "@/lib/validation/block";
import type { JsonLd, SchemaIssue } from "@/lib/schema/types";

export const schemaPreviewSchema = z.object({
  contentType: z.enum(
    CONTENT_TYPE_KEYS as [ContentTypeKey, ...ContentTypeKey[]],
  ),
  /** The editor's current form values (shape varies by content type). */
  values: z.record(z.unknown()).default({}),
  overrides: schemaOverrideSchema.optional(),
});

export type SchemaPreviewInput = z.infer<typeof schemaPreviewSchema>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;

/** Q&A pairs off a form value, tolerating partially-filled rows. */
function faqsFrom(v: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => {
      const row = f as { question?: unknown; answer?: unknown };
      return { question: str(row.question) ?? "", answer: str(row.answer) ?? "" };
    })
    .filter((f) => f.question && f.answer);
}

/**
 * Map an editor's form values onto the data its adapter expects.
 *
 * Returns `null` for a content type that has no editor (and therefore no
 * preview) — the panel simply doesn't render for those.
 */
function toAdapterData(
  contentType: ContentTypeKey,
  values: Record<string, unknown>,
): unknown | null {
  switch (contentType) {
    case "page": {
      const slug = str(values.slug) ?? "";
      return {
        page: {
          name: str(values.title) ?? "",
          description: str(values.intro),
          path: `/${slug}`,
        },
        blocks: blocksSchema.safeParse(values.blocks).data ?? [],
      };
    }

    case "blogPost": {
      return {
        post: {
          title: str(values.title) ?? "",
          slug: str(values.slug) ?? "",
          excerpt: str(values.excerpt),
          coverImageUrl: str(
            (values.coverImage as { url?: string } | undefined)?.url,
          ),
          author: str(values.author),
          publishedAt: str(values.publishedAt) ?? null,
          updatedAt: null,
        },
      };
    }

    case "matrixPage": {
      return {
        webPage: {
          name: str(values.title) ?? "",
          description: str(values.metaDescription) ?? str(values.intro),
          path: str(values.path) ?? "/",
        },
        faqs: faqsFrom(values.faqs),
        items: [],
      };
    }

    default:
      return null;
  }
}

export interface SchemaPreviewResult {
  nodes: JsonLd[];
  issues: SchemaIssue[];
}

/** Build the preview for a draft. */
export async function buildSchemaPreview(
  input: SchemaPreviewInput,
): Promise<SchemaPreviewResult> {
  const data = toAdapterData(input.contentType, input.values);
  if (data === null) return { nodes: [], issues: [] };

  const ctx = await getSchemaContext();

  // `previewJsonLd` is generic over the content-type key; the mapper above
  // guarantees `data` matches the adapter for this key.
  return previewJsonLd(
    input.contentType,
    data as never,
    ctx,
    input.overrides ?? null,
  );
}

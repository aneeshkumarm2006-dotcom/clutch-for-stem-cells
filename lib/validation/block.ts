/**
 * Modular content blocks — the Zod contract for every block type.
 *
 * One discriminated union keyed on `type`, so a Page's `blocks` array is fully
 * validated on write: an unknown `type` or a malformed `data` payload is a 422,
 * never a silently-persisted bad block. HTML-bearing blocks (`richText`,
 * `rawHtml`) are additionally sanitized server-side on save — this schema
 * validates shape, `sanitizeBlogHtml` validates content.
 *
 * Adding a block type is an isolated change: add its schema here, add the
 * matching entry to the block registry (`components/blocks/registry.tsx`), and
 * list it in `config/content-engine`. Nothing else moves.
 */
import { z } from "zod";

import { CALLOUT_TONES } from "@/lib/enums";
import { blankToUndefined, imageSchema, mediaUrlSchema } from "@/lib/validation/common";

/** An optional section heading — every titled block shares this shape. */
const headingSchema = z.preprocess(
  blankToUndefined,
  z.string().max(200).optional(),
);

/** Optional short prose above a block's list/table body. */
const introSchema = z.preprocess(
  blankToUndefined,
  z.string().max(2_000).optional(),
);

/** Optional qualifying line below a block's body (caveats, "varies by clinic"). */
const footnoteSchema = z.preprocess(
  blankToUndefined,
  z.string().max(1_000).optional(),
);

/** Rich text — sanitized HTML from the shared Tiptap editor. */
export const richTextBlockSchema = z.object({
  html: z.string().max(200_000).default(""),
});

/**
 * Key takeaways — the answer-first summary box. Deliberately bullets-only:
 * extractable for answer engines and impossible to pad into an essay.
 */
export const keyTakeawaysBlockSchema = z.object({
  title: headingSchema,
  items: z.array(z.string().max(500)).default([]),
});

/** Numbered process — how something is done, in order. */
export const stepsBlockSchema = z.object({
  title: headingSchema,
  intro: introSchema,
  steps: z
    .array(
      z.object({
        title: z.string().min(1, "Step text is required").max(300),
        description: z.preprocess(
          blankToUndefined,
          z.string().max(1_500).optional(),
        ),
      }),
    )
    .default([]),
  footnote: footnoteSchema,
});

/** Ticked bullet list — "what to compare", "what to bring", etc. */
export const checklistBlockSchema = z.object({
  title: headingSchema,
  intro: introSchema,
  items: z.array(z.string().max(500)).default([]),
  footnote: footnoteSchema,
});

/** Sourced numbers rendered large — a concrete E-E-A-T signal. */
export const statGridBlockSchema = z.object({
  title: headingSchema,
  stats: z
    .array(
      z.object({
        value: z.string().min(1, "Stat value is required").max(60),
        label: z.string().min(1, "Stat label is required").max(200),
        sourceUrl: z.preprocess(blankToUndefined, mediaUrlSchema.optional()),
      }),
    )
    .default([]),
});

/** A note / tip / important / caution box set apart from the surrounding prose. */
export const calloutBlockSchema = z.object({
  tone: z.enum(CALLOUT_TONES).default("note"),
  title: headingSchema,
  body: z.string().max(2_000).default(""),
});

/** Pull quote with attribution. */
export const quoteBlockSchema = z.object({
  quote: z.string().min(1, "Quote text is required").max(1_500),
  attribution: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  /** Role / affiliation shown under the name. */
  role: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  sourceUrl: z.preprocess(blankToUndefined, mediaUrlSchema.optional()),
});

/** Related reading — the internal-linking block. */
export const linkListBlockSchema = z.object({
  title: headingSchema,
  links: z
    .array(
      z.object({
        label: z.string().min(1, "Link label is required").max(200),
        href: mediaUrlSchema,
        description: z.preprocess(
          blankToUndefined,
          z.string().max(500).optional(),
        ),
      }),
    )
    .default([]),
});

/** FAQ — emits `FAQPage` JSON-LD automatically (schema-aware block). */
export const faqBlockSchema = z.object({
  title: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  items: z
    .array(
      z.object({
        question: z.string().min(1, "Question is required").max(300),
        answer: z.string().min(1, "Answer is required").max(5_000),
      }),
    )
    .default([]),
});

/** Comparison table — feeds an `ItemList` (schema-aware block). */
export const comparisonBlockSchema = z.object({
  title: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  /** Column headers, excluding the leading row-label column. */
  columns: z.array(z.string().max(120)).default([]),
  rows: z
    .array(
      z.object({
        label: z.string().min(1, "Row label is required").max(200),
        /** One cell per column, in order. */
        cells: z.array(z.string().max(500)).default([]),
        /** Optional link for the compared item → `ListItem.url`. */
        url: z.preprocess(blankToUndefined, mediaUrlSchema.optional()),
      }),
    )
    .default([]),
});

/** Feature / benefit grid. */
export const featureGridBlockSchema = z.object({
  title: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  items: z
    .array(
      z.object({
        title: z.string().min(1, "Feature title is required").max(200),
        description: z.preprocess(
          blankToUndefined,
          z.string().max(1_000).optional(),
        ),
        /** Lucide icon name, e.g. "ShieldCheck". */
        icon: z.preprocess(blankToUndefined, z.string().max(60).optional()),
      }),
    )
    .default([]),
});

/** Pros & cons — a balanced two-column list. */
export const prosConsBlockSchema = z.object({
  title: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  pros: z.array(z.string().max(500)).default([]),
  cons: z.array(z.string().max(500)).default([]),
});

/** Call to action. */
export const ctaBlockSchema = z.object({
  title: z.string().min(1, "CTA title is required").max(200),
  body: z.preprocess(blankToUndefined, z.string().max(1_000).optional()),
  buttonLabel: z.string().min(1, "Button label is required").max(80),
  buttonHref: mediaUrlSchema,
});

/** Image / media with an optional caption. */
export const mediaBlockSchema = z.object({
  image: imageSchema,
  caption: z.preprocess(blankToUndefined, z.string().max(500).optional()),
});

/** Raw HTML / embed — sanitized server-side, never trusted from the client. */
export const rawHtmlBlockSchema = z.object({
  html: z.string().max(50_000).default(""),
});

/**
 * The discriminated union. `blockSchema.parse({ type, data })` is the single
 * gate every Page write passes through.
 */
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("richText"), data: richTextBlockSchema }),
  z.object({ type: z.literal("keyTakeaways"), data: keyTakeawaysBlockSchema }),
  z.object({ type: z.literal("steps"), data: stepsBlockSchema }),
  z.object({ type: z.literal("checklist"), data: checklistBlockSchema }),
  z.object({ type: z.literal("comparisonTable"), data: comparisonBlockSchema }),
  z.object({ type: z.literal("faq"), data: faqBlockSchema }),
  z.object({ type: z.literal("featureGrid"), data: featureGridBlockSchema }),
  z.object({ type: z.literal("prosCons"), data: prosConsBlockSchema }),
  z.object({ type: z.literal("statGrid"), data: statGridBlockSchema }),
  z.object({ type: z.literal("callout"), data: calloutBlockSchema }),
  z.object({ type: z.literal("quote"), data: quoteBlockSchema }),
  z.object({ type: z.literal("linkList"), data: linkListBlockSchema }),
  z.object({ type: z.literal("cta"), data: ctaBlockSchema }),
  z.object({ type: z.literal("media"), data: mediaBlockSchema }),
  z.object({ type: z.literal("rawHtml"), data: rawHtmlBlockSchema }),
]);

export const blocksSchema = z.array(blockSchema).max(100).default([]);

export type BlockInput = z.infer<typeof blockSchema>;
export type RichTextBlock = z.infer<typeof richTextBlockSchema>;
export type KeyTakeawaysBlock = z.infer<typeof keyTakeawaysBlockSchema>;
export type StepsBlock = z.infer<typeof stepsBlockSchema>;
export type ChecklistBlock = z.infer<typeof checklistBlockSchema>;
export type FaqBlock = z.infer<typeof faqBlockSchema>;
export type ComparisonBlock = z.infer<typeof comparisonBlockSchema>;
export type FeatureGridBlock = z.infer<typeof featureGridBlockSchema>;
export type ProsConsBlock = z.infer<typeof prosConsBlockSchema>;
export type StatGridBlock = z.infer<typeof statGridBlockSchema>;
export type CalloutBlock = z.infer<typeof calloutBlockSchema>;
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;
export type LinkListBlock = z.infer<typeof linkListBlockSchema>;
export type CtaBlock = z.infer<typeof ctaBlockSchema>;
export type MediaBlock = z.infer<typeof mediaBlockSchema>;
export type RawHtmlBlock = z.infer<typeof rawHtmlBlockSchema>;

/** A block narrowed to one `type` — handy for the per-type editors/renderers. */
export type BlockOf<T extends BlockInput["type"]> = Extract<
  BlockInput,
  { type: T }
>;

/**
 * The structured-data engine.
 *
 * `buildJsonLd(type, data, ctx, overrides)` is the single entry point every
 * public page uses. It:
 *   1. looks the content type up in `config/content-engine`,
 *   2. runs the mapped builder (which delegates to the existing generators in
 *      `lib/seo.ts` — this engine adds orchestration, it does not re-implement
 *      a single node),
 *   3. applies the record's per-page overrides (disabled nodes, field
 *      overrides, custom JSON-LD),
 *   4. drops anything invalid so a page can never emit malformed JSON-LD.
 *
 * Domain-free by construction: the only thing it knows about a "clinic" is that
 * `clinic` is a key in the config. Porting means rewriting the config + adapters.
 */
import {
  CONTENT_ENGINE,
  type ContentTypeData,
  type ContentTypeKey,
} from "@/config/content-engine";
import type { ISchemaOverrides } from "@/models/_shared";
import {
  dropInvalidNodes,
  parseCustomJsonLd,
  validateNodes,
} from "@/lib/schema/validate";
import type { JsonLd, SchemaContext, SchemaIssue } from "@/lib/schema/types";

/** The `@type` of a node, or `""` when it somehow has none. */
function nodeType(node: JsonLd): string {
  const t = node["@type"];
  return typeof t === "string" ? t : "";
}

/**
 * Nodes that schema.org nests inside a parent rather than emitting standalone.
 * Toggling one off in the admin panel has to *remove the nested key* on its
 * parent — dropping a top-level node would do nothing, because there isn't one.
 */
const NESTED_NODES: Record<string, { parent: string; key: string }> = {
  AggregateRating: { parent: "MedicalClinic", key: "aggregateRating" },
};

/**
 * Apply the editor's per-page overrides to the auto-generated graph.
 *
 * Order matters: drop disabled nodes first (so we never waste work overriding a
 * node that is about to disappear), then apply field overrides, then append the
 * custom JSON-LD — custom nodes are the editor's explicit escape hatch and are
 * never filtered by the toggles.
 */
function applyOverrides(
  nodes: JsonLd[],
  overrides?: ISchemaOverrides | null,
): JsonLd[] {
  if (!overrides) return nodes;

  const disabled = new Set(overrides.disabledNodes ?? []);
  let result = nodes;

  if (disabled.size) {
    // Strip standalone nodes whose @type is switched off.
    result = result.filter((node) => !disabled.has(nodeType(node)));

    // Strip nested nodes (e.g. AggregateRating inside MedicalClinic) by
    // deleting the key from the parent — there is no top-level node to remove.
    for (const type of disabled) {
      const nested = NESTED_NODES[type];
      if (!nested) continue;
      result = result.map((node) => {
        if (nodeType(node) !== nested.parent) return node;
        const rest = { ...node };
        delete rest[nested.key];
        return rest;
      });
    }
  }

  const fieldOverrides = overrides.fieldOverrides;
  if (fieldOverrides && Object.keys(fieldOverrides).length) {
    result = result.map((node) => {
      const patch = fieldOverrides[nodeType(node)];
      if (!patch || !Object.keys(patch).length) return node;
      // Shallow merge: an editor overriding `name` must not wipe `address`.
      return { ...node, ...patch };
    });
  }

  const custom = parseCustomJsonLd(overrides.customJsonLd);
  if (custom) result = [...result, ...custom];

  return result;
}

/**
 * Build the JSON-LD graph for one page.
 *
 * Returns `[]` (never `null`/`undefined`) when a content type produces nothing,
 * so callers can hand the result straight to `<JsonLd data={…} />`, which
 * renders nothing for an empty array.
 */
export function buildJsonLd<K extends ContentTypeKey>(
  type: K,
  data: ContentTypeData<K>,
  ctx: SchemaContext,
  overrides?: ISchemaOverrides | null,
): JsonLd[] {
  const config = CONTENT_ENGINE.contentTypes[type];
  if (!config) return [];

  // The config's builders are typed via `defineContentType`, but TS can't prove
  // the union member matches `K` after the lookup — the cast is safe because
  // `ContentTypeData<K>` is *derived from* this exact entry.
  const build = config.build as (d: ContentTypeData<K>, c: SchemaContext) => (
    | JsonLd
    | null
    | undefined
  )[];

  const built = build(data, ctx).filter((n): n is JsonLd => Boolean(n));
  const withOverrides = applyOverrides(built, overrides);

  // Render-time backstop: never emit a node that fails its required fields.
  return dropInvalidNodes(withOverrides);
}

/**
 * Build a graph *and* report its issues, without dropping anything. This is what
 * the admin schema panel previews: the editor needs to see the invalid node and
 * why it is invalid, not silently lose it.
 */
export function previewJsonLd<K extends ContentTypeKey>(
  type: K,
  data: ContentTypeData<K>,
  ctx: SchemaContext,
  overrides?: ISchemaOverrides | null,
): { nodes: JsonLd[]; issues: SchemaIssue[] } {
  const config = CONTENT_ENGINE.contentTypes[type];
  if (!config) return { nodes: [], issues: [] };

  const build = config.build as (d: ContentTypeData<K>, c: SchemaContext) => (
    | JsonLd
    | null
    | undefined
  )[];

  const built = build(data, ctx).filter((n): n is JsonLd => Boolean(n));
  const nodes = applyOverrides(built, overrides);

  const issues = validateNodes(nodes);
  if (overrides?.customJsonLd?.trim() && !parseCustomJsonLd(overrides.customJsonLd)) {
    issues.push({
      node: "Custom JSON-LD",
      level: "error",
      message: "Custom JSON-LD is not valid JSON (expected an object or an array of objects).",
    });
  }

  return { nodes, issues };
}

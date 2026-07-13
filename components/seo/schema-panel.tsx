"use client";

import * as React from "react";
import { AlertTriangle, Braces, Check, Info } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import type { ContentTypeKey } from "@/config/content-engine";
import type { JsonLd, SchemaIssue } from "@/lib/schema/types";
import type { SchemaOverrideInput } from "@/lib/validation/common";

/**
 * The structured-data panel — one component, dropped into any record editor.
 *
 * Deliberately "idiom-neutral" (a controlled `value`/`onChange` pair, no form
 * library) so it drops into both the /seoteam editors, which hold plain
 * `useState`, and the /admin forms, which use the composed field primitives.
 *
 * It shows what the page will actually emit by asking the server to run the real
 * engine on the current draft — never by re-implementing the engine in the
 * browser, which would drift from the live page the first time either changed.
 */

export interface SchemaPanelProps {
  contentType: ContentTypeKey;
  /** The `@type`s this content type can emit (from `nodesFor(contentType)`). */
  availableNodes: readonly string[];
  /** The editor's current form values — posted to the preview endpoint. */
  values: Record<string, unknown>;
  value: SchemaOverrideInput;
  onChange: (next: SchemaOverrideInput) => void;
  /** Preview endpoint — `/api/seoteam/schema/preview` or the admin equivalent. */
  endpoint?: string;
  /** Bubbles up "there are blocking errors" so the editor can refuse to save. */
  onValidityChange?: (valid: boolean) => void;
}

interface PreviewResponse {
  nodes: JsonLd[];
  issues: SchemaIssue[];
}

export function SchemaPanel({
  contentType,
  availableNodes,
  values,
  value,
  onChange,
  endpoint = "/api/seoteam/schema/preview",
  onValidityChange,
}: SchemaPanelProps) {
  const [preview, setPreview] = React.useState<PreviewResponse>({
    nodes: [],
    issues: [],
  });
  const [loading, setLoading] = React.useState(false);
  const [showJson, setShowJson] = React.useState(false);

  const disabled = React.useMemo(
    () => new Set(value.disabledNodes ?? []),
    [value.disabledNodes],
  );

  // The custom JSON-LD box is the one thing we can validate without the server,
  // so do it instantly — the editor shouldn't wait a debounce to learn a brace
  // is missing.
  const customJsonError = React.useMemo(() => {
    const raw = value.customJsonLd?.trim();
    if (!raw) return null;
    try {
      JSON.parse(raw);
      return null;
    } catch {
      return "Not valid JSON.";
    }
  }, [value.customJsonLd]);

  // Debounced live preview. `values` is a new object on every keystroke, so key
  // the effect on its serialization rather than its identity.
  const valuesKey = JSON.stringify(values);
  const overridesKey = JSON.stringify(value);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await adminFetch<PreviewResponse>(endpoint, {
          method: "POST",
          body: { contentType, values, overrides: value },
        });
        if (!cancelled) setPreview(res);
      } catch {
        // A failed preview must never block editing — leave the last good one up.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, endpoint, valuesKey, overridesKey]);

  const errors = preview.issues.filter((i) => i.level === "error");
  const warnings = preview.issues.filter((i) => i.level === "warning");
  const valid = errors.length === 0 && !customJsonError;

  React.useEffect(() => {
    onValidityChange?.(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  const toggleNode = (node: string) => {
    const next = new Set(disabled);
    if (next.has(node)) next.delete(node);
    else next.add(node);
    onChange({ ...value, disabledNodes: [...next] });
  };

  const setFieldOverride = (node: string, key: string, raw: string) => {
    const all = { ...(value.fieldOverrides ?? {}) };
    const forNode = { ...(all[node] ?? {}) };

    if (!raw.trim()) delete forNode[key];
    else forNode[key] = raw;

    if (Object.keys(forNode).length) all[node] = forNode;
    else delete all[node];

    onChange({ ...value, fieldOverrides: all });
  };

  return (
    <div className="space-y-3">
      {/* Validation */}
      {errors.length ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-danger">
            <AlertTriangle className="size-3.5" />
            {errors.length} blocking issue{errors.length === 1 ? "" : "s"}
          </div>
          <ul className="space-y-0.5 text-[12px] text-text-secondary">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-warning">
            <Info className="size-3.5" />
            Recommended fields missing
          </div>
          <ul className="space-y-0.5 text-[12px] text-text-secondary">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!errors.length && !warnings.length && preview.nodes.length ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-success">
          <Check className="size-3.5" />
          {preview.nodes.length} valid schema node
          {preview.nodes.length === 1 ? "" : "s"}
        </p>
      ) : null}

      {/* Node toggles */}
      <div>
        <Label>Schema types</Label>
        <div className="mt-1.5 space-y-1.5">
          {availableNodes.map((node) => (
            <label
              key={node}
              className="flex items-center gap-2 text-[13px] text-text-secondary"
            >
              <input
                type="checkbox"
                checked={!disabled.has(node)}
                onChange={() => toggleNode(node)}
              />
              <code className="rounded bg-surface-alt px-1 py-0.5 text-[11.5px]">
                {node}
              </code>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-text-muted">
          Unchecked types are omitted from this page&apos;s JSON-LD.
        </p>
      </div>

      {/* Field overrides — driven off the nodes the engine actually built */}
      {preview.nodes.length ? (
        <div>
          <Label>Field overrides</Label>
          <div className="mt-1.5 space-y-3">
            {preview.nodes.map((node, i) => (
              <NodeFields
                key={i}
                node={node}
                overrides={value.fieldOverrides}
                onOverride={setFieldOverride}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-text-muted">
            Leave blank to keep the auto-generated value.
          </p>
        </div>
      ) : null}

      {/* Custom JSON-LD escape hatch */}
      <div>
        <Label htmlFor="custom-jsonld">Custom JSON-LD</Label>
        <Textarea
          id="custom-jsonld"
          rows={4}
          className="font-mono text-[12px]"
          value={value.customJsonLd ?? ""}
          onChange={(e) =>
            onChange({ ...value, customJsonLd: e.target.value })
          }
          placeholder='{"@context":"https://schema.org","@type":"…"}'
        />
        {customJsonError ? (
          <p className="mt-1 text-[12px] text-danger">{customJsonError}</p>
        ) : (
          <p className="mt-1 text-[11.5px] text-text-muted">
            Appended verbatim. An object or an array of objects.
          </p>
        )}
      </div>

      {/* Raw preview */}
      <div>
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-link hover:underline"
        >
          <Braces className="size-3.5" />
          {showJson ? "Hide" : "Show"} generated JSON-LD
          {loading ? (
            <span className="text-text-muted">· updating…</span>
          ) : null}
        </button>
        {showJson ? (
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-surface-alt p-3 text-[11px] leading-relaxed text-text-secondary">
            {JSON.stringify(preview.nodes, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The editable scalar fields of one built node. Nested objects/arrays (an
 * address, an itemList) are intentionally not editable here — overriding those
 * inline invites malformed structures. The custom JSON-LD box is the escape
 * hatch for that.
 */
function NodeFields({
  node,
  overrides,
  onOverride,
}: {
  node: JsonLd;
  overrides?: Record<string, Record<string, unknown>>;
  onOverride: (node: string, key: string, value: string) => void;
}) {
  const type = typeof node["@type"] === "string" ? node["@type"] : "Unknown";

  const scalarKeys = Object.keys(node).filter((k) => {
    if (k.startsWith("@")) return false;
    const v = node[k];
    return typeof v === "string" || typeof v === "number";
  });

  if (!scalarKeys.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-alt p-2.5">
      <p className="mb-1.5 font-mono text-[11.5px] font-semibold text-text-primary">
        {type}
      </p>
      <div className="space-y-1.5">
        {scalarKeys.map((key) => {
          const override = overrides?.[type]?.[key];
          const current = override ?? node[key];
          return (
            <div key={key} className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span
                className="truncate text-[11.5px] text-text-muted"
                title={key}
              >
                {key}
              </span>
              <Input
                value={typeof current === "string" ? current : String(current)}
                onChange={(e) => onOverride(type, key, e.target.value)}
                className={cn(
                  "h-7 text-[12px]",
                  override != null && "border-primary",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

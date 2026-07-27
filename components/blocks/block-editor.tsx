"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/seoteam/rich-text-editor";
import { ImageField } from "@/components/seoteam/image-field";
import { cn } from "@/lib/utils";
import { isSchemaAwareBlock } from "@/lib/blocks/schema";
import { BLOCK_TYPE_LABELS, type BlockType } from "@/lib/enums";
import type { BlockInput } from "@/lib/validation/block";

/**
 * The block composer — add, remove, reorder, and edit the blocks a page is made
 * of.
 *
 * Reorder is up/down buttons rather than drag-and-drop: it is keyboard- and
 * screen-reader-accessible for free, needs no new dependency, and works on
 * touch. (A drag handle is shown as an affordance and is purely decorative.)
 *
 * Each block type owns its own small form (`BlockForm` below). Adding a type
 * means adding one `case` there and one entry to the block schema — nothing else
 * in the editor changes.
 */

/** The empty payload a newly-added block of each type starts from. */
const DEFAULTS: { [K in BlockType]: Extract<BlockInput, { type: K }>["data"] } = {
  richText: { html: "" },
  faq: { title: undefined, items: [] },
  comparisonTable: { title: undefined, columns: [], rows: [] },
  featureGrid: { title: undefined, items: [] },
  prosCons: { title: undefined, pros: [], cons: [] },
  cta: { title: "", body: undefined, buttonLabel: "", buttonHref: "" },
  media: { image: { url: "" }, caption: undefined },
  rawHtml: { html: "" },
};

function newBlock(type: BlockType): BlockInput {
  return { type, data: DEFAULTS[type] } as BlockInput;
}

export function BlockEditor({
  value,
  onChange,
  enabledTypes,
}: {
  value: BlockInput[];
  onChange: (next: BlockInput[]) => void;
  /** The block types this dashboard enables (from `config/content-engine`). */
  enabledTypes: readonly BlockType[];
}) {
  const [adding, setAdding] = React.useState(false);

  const update = (i: number, data: unknown) =>
    onChange(
      value.map((b, j) => (j === i ? ({ ...b, data } as BlockInput) : b)),
    );

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  /** Swap a block with its neighbour. `dir` is -1 (up) or +1 (down). */
  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange(next);
  };

  const add = (type: BlockType) => {
    onChange([...value, newBlock(type)]);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {value.map((block, i) => (
        <BlockCard
          key={i}
          block={block}
          index={i}
          total={value.length}
          onChange={(data) => update(i, data)}
          onRemove={() => remove(i)}
          onMove={(dir) => move(i, dir)}
        />
      ))}

      {!value.length ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-alt/50 p-8 text-center">
          <p className="text-[13.5px] text-text-muted">
            This page has no content yet. Add your first block to begin.
          </p>
        </div>
      ) : null}

      {/* Add-block picker */}
      {adding ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-text-primary">
              Add a block
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {enabledTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => add(type)}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-[13.5px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-alt"
              >
                {BLOCK_TYPE_LABELS[type]}
                {isSchemaAwareBlock(type) ? <SchemaBadge /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
          className="w-full"
        >
          <Plus className="size-4" /> Add block
        </Button>
      )}
    </div>
  );
}

/** Marks a block that contributes structured data just by being used. */
function SchemaBadge() {
  return (
    <span
      title="This block automatically adds structured data (JSON-LD)"
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-azure-700"
    >
      <Sparkles className="size-3" aria-hidden="true" />
      Schema
    </span>
  );
}

function BlockCard({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  block: BlockInput;
  index: number;
  total: number;
  onChange: (data: unknown) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <GripVertical
          className="size-4 shrink-0 text-text-muted"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="font-display text-[13.5px] font-semibold text-text-primary">
            {BLOCK_TYPE_LABELS[block.type]}
          </span>
          {isSchemaAwareBlock(block.type) ? <SchemaBadge /> : null}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label={`Move ${BLOCK_TYPE_LABELS[block.type]} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="size-4" />
          </IconButton>
          <IconButton
            label={`Move ${BLOCK_TYPE_LABELS[block.type]} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="size-4" />
          </IconButton>
          <IconButton
            label={`Remove ${BLOCK_TYPE_LABELS[block.type]}`}
            onClick={onRemove}
            danger
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {open ? (
        <div className="space-y-3 p-4">
          <BlockForm block={block} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-md p-1.5 text-text-muted transition-colors",
        disabled
          ? "cursor-not-allowed opacity-30"
          : danger
            ? "hover:bg-surface-alt hover:text-danger"
            : "hover:bg-surface-alt hover:text-text-secondary",
      )}
    >
      {children}
    </button>
  );
}

// ── Per-type forms ──────────────────────────────────────────────────────────

/**
 * The one place a block type's edit UI lives. Exhaustive over the union, so a
 * new block type without a form is a compile error rather than an empty card.
 */
function BlockForm({
  block,
  onChange,
}: {
  block: BlockInput;
  onChange: (data: unknown) => void;
}) {
  switch (block.type) {
    case "richText":
      return (
        <RichTextEditor
          value={block.data.html}
          onChange={(html) => onChange({ html })}
        />
      );

    case "rawHtml":
      return (
        <div className="space-y-1.5">
          <Label>HTML / embed code</Label>
          <Textarea
            rows={6}
            className="font-mono text-[12px]"
            value={block.data.html}
            onChange={(e) => onChange({ html: e.target.value })}
            placeholder="<iframe src …>"
          />
          <p className="text-[11.5px] text-text-muted">
            Sanitized on save. Scripts and event handlers are stripped.
          </p>
        </div>
      );

    case "faq": {
      const d = block.data;
      return (
        <>
          <TitleField
            value={d.title ?? ""}
            onChange={(title) => onChange({ ...d, title })}
            placeholder="Frequently asked questions"
          />
          <ListEditor
            label="Questions"
            addLabel="Add question"
            items={d.items}
            onChange={(items) => onChange({ ...d, items })}
            create={() => ({ question: "", answer: "" })}
            render={(item, set) => (
              <div className="flex-1 space-y-2">
                <Input
                  value={item.question}
                  onChange={(e) => set({ ...item, question: e.target.value })}
                  placeholder="Question phrased as a real search query"
                />
                <Textarea
                  rows={2}
                  value={item.answer}
                  onChange={(e) => set({ ...item, answer: e.target.value })}
                  placeholder="Direct, cautious answer"
                />
              </div>
            )}
          />
        </>
      );
    }

    case "comparisonTable": {
      const d = block.data;
      return (
        <>
          <TitleField
            value={d.title ?? ""}
            onChange={(title) => onChange({ ...d, title })}
            placeholder="Comparison"
          />
          <div className="space-y-1.5">
            <Label>Columns (comma-separated)</Label>
            <Input
              value={d.columns.join(", ")}
              onChange={(e) =>
                onChange({
                  ...d,
                  columns: e.target.value
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Cost, Duration, Evidence"
            />
          </div>
          <ListEditor
            label="Rows"
            addLabel="Add row"
            items={d.rows}
            onChange={(rows) => onChange({ ...d, rows })}
            create={() => ({ label: "", cells: [], url: undefined })}
            render={(row, set) => (
              <div className="flex-1 space-y-2">
                <Input
                  value={row.label}
                  onChange={(e) => set({ ...row, label: e.target.value })}
                  placeholder="Row label (the compared item)"
                />
                <Input
                  value={row.url ?? ""}
                  onChange={(e) =>
                    set({ ...row, url: e.target.value || undefined })
                  }
                  placeholder="Link (optional)"
                />
                {d.columns.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {d.columns.map((col, c) => (
                      <Input
                        key={c}
                        value={row.cells[c] ?? ""}
                        onChange={(e) => {
                          const cells = [...row.cells];
                          while (cells.length < d.columns.length) cells.push("");
                          cells[c] = e.target.value;
                          set({ ...row, cells });
                        }}
                        placeholder={col}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-text-muted">
                    Add columns above to fill in this row.
                  </p>
                )}
              </div>
            )}
          />
        </>
      );
    }

    case "featureGrid": {
      const d = block.data;
      return (
        <>
          <TitleField
            value={d.title ?? ""}
            onChange={(title) => onChange({ ...d, title })}
            placeholder="What you get"
          />
          <ListEditor
            label="Features"
            addLabel="Add feature"
            items={d.items}
            onChange={(items) => onChange({ ...d, items })}
            create={() => ({ title: "", description: undefined, icon: undefined })}
            render={(item, set) => (
              <div className="flex-1 space-y-2">
                <Input
                  value={item.title}
                  onChange={(e) => set({ ...item, title: e.target.value })}
                  placeholder="Feature title"
                />
                <Textarea
                  rows={2}
                  value={item.description ?? ""}
                  onChange={(e) =>
                    set({ ...item, description: e.target.value || undefined })
                  }
                  placeholder="What it means for the reader"
                />
              </div>
            )}
          />
        </>
      );
    }

    case "prosCons": {
      const d = block.data;
      return (
        <>
          <TitleField
            value={d.title ?? ""}
            onChange={(title) => onChange({ ...d, title })}
            placeholder="Pros & cons"
          />
          <StringListEditor
            label="Pros"
            items={d.pros}
            onChange={(pros) => onChange({ ...d, pros })}
            placeholder="A genuine advantage"
          />
          <StringListEditor
            label="Cons"
            items={d.cons}
            onChange={(cons) => onChange({ ...d, cons })}
            placeholder="An honest limitation"
          />
        </>
      );
    }

    case "cta": {
      const d = block.data;
      return (
        <>
          <div className="space-y-1.5">
            <Label>Heading</Label>
            <Input
              value={d.title}
              onChange={(e) => onChange({ ...d, title: e.target.value })}
              placeholder="Ready to find a clinic?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              rows={2}
              value={d.body ?? ""}
              onChange={(e) =>
                onChange({ ...d, body: e.target.value || undefined })
              }
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Button label</Label>
              <Input
                value={d.buttonLabel}
                onChange={(e) =>
                  onChange({ ...d, buttonLabel: e.target.value })
                }
                placeholder="Browse clinics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Button link</Label>
              <Input
                value={d.buttonHref}
                onChange={(e) => onChange({ ...d, buttonHref: e.target.value })}
                placeholder="/clinics"
              />
            </div>
          </div>
        </>
      );
    }

    case "media": {
      const d = block.data;
      return (
        <>
          <ImageField
            label="Image"
            value={d.image?.url ? d.image : undefined}
            onChange={(image) =>
              onChange({ ...d, image: image ?? { url: "" } })
            }
          />
          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Input
              value={d.caption ?? ""}
              onChange={(e) =>
                onChange({ ...d, caption: e.target.value || undefined })
              }
            />
          </div>
        </>
      );
    }
  }
}

function TitleField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string | undefined) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Heading</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Generic add/remove list of objects — the repeater shape used across the CMS. */
function ListEditor<T>({
  label,
  addLabel,
  items,
  onChange,
  create,
  render,
}: {
  label: string;
  addLabel: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, set: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, create()])}
        >
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {render(item, (next) =>
            onChange(items.map((it, j) => (j === i ? next : it))),
          )}
          <IconButton
            label="Remove"
            danger
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

/** Add/remove list of plain strings (pros, cons). */
function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <ListEditor
      label={label}
      addLabel="Add"
      items={items}
      onChange={onChange}
      create={() => ""}
      render={(item, set) => (
        <Input
          className="flex-1"
          value={item}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
        />
      )}
    />
  );
}

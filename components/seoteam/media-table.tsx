"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpDown,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MediaSort, SeoMediaRow } from "@/lib/seoteam/media-data";
import { MediaThumb } from "@/components/seoteam/media-thumb";
import {
  copyToClipboard,
  imgTagFor,
  markdownFor,
} from "@/components/seoteam/media-actions";

export function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Stable, locale-fixed date (avoids SSR/CSR hydration mismatch). */
function fmtDate(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface MediaTableProps {
  rows: SeoMediaRow[];
  selected: Set<string>;
  allOnPage: boolean;
  currentSort: MediaSort;
  onToggleOne: (id: string) => void;
  onToggleAll: () => void;
  onSort: (sort: MediaSort) => void;
  onPreview: (row: SeoMediaRow) => void;
  onEdit: (row: SeoMediaRow) => void;
  onDelete: (row: SeoMediaRow) => void;
  /** Persist an inline metadata edit; resolves on success, rejects to roll back. */
  onSaveInline: (id: string, patch: Partial<SeoMediaRow>) => Promise<void>;
}

export function MediaTable({
  rows,
  selected,
  allOnPage,
  currentSort,
  onToggleOne,
  onToggleAll,
  onSort,
  onPreview,
  onEdit,
  onDelete,
  onSaveInline,
}: MediaTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-3">
              <input
                type="checkbox"
                aria-label={allOnPage ? "Deselect all" : "Select all"}
                checked={allOnPage}
                onChange={onToggleAll}
                className="size-4 cursor-pointer accent-primary"
              />
            </TableHead>
            <TableHead className="w-16">Preview</TableHead>
            <SortHead
              label="Filename"
              sortKey="name"
              current={currentSort}
              onSort={onSort}
            />
            <TableHead className="min-w-[180px]">Alt text</TableHead>
            <TableHead className="min-w-[160px]">Tags</TableHead>
            <SortHead
              label="Used in"
              sortKey="usage"
              current={currentSort}
              onSort={onSort}
            />
            <SortHead
              label="Dimensions"
              sortKey="dimensions"
              current={currentSort}
              onSort={onSort}
            />
            <SortHead
              label="Size"
              sortKey="size"
              current={currentSort}
              onSort={onSort}
            />
            <TableHead>Format</TableHead>
            <TableHead className="min-w-[160px]">URL</TableHead>
            <SortHead
              label="Uploaded"
              sortKey="newest"
              current={currentSort}
              onSort={onSort}
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <TableRow key={m.id} data-selected={isSelected}>
                <TableCell className="pl-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${m.filename ?? m.alt ?? "image"}`}
                    checked={isSelected}
                    onChange={() => onToggleOne(m.id)}
                    className="size-4 cursor-pointer accent-primary"
                  />
                </TableCell>

                {/* Preview → lightbox */}
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onPreview(m)}
                    aria-label={`Preview ${m.filename ?? m.alt ?? "image"}`}
                    className="relative block size-11 overflow-hidden rounded-md border border-border bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MediaThumb src={m.url} alt={m.alt ?? ""} sizes="44px" />
                  </button>
                </TableCell>

                {/* Filename / public_id */}
                <TableCell className="max-w-[200px]">
                  <div
                    className="truncate font-medium"
                    title={m.filename ?? m.publicId ?? ""}
                  >
                    {m.filename ?? "–"}
                  </div>
                  {m.publicId ? (
                    <div
                      className="truncate text-[11px] text-text-muted"
                      title={m.publicId}
                    >
                      {m.publicId}
                    </div>
                  ) : null}
                </TableCell>

                {/* Alt (inline editable) */}
                <TableCell className="max-w-[240px]">
                  <AltCell
                    value={m.alt ?? ""}
                    onSave={(alt) => onSaveInline(m.id, { alt })}
                  />
                </TableCell>

                {/* Tags (inline chips) */}
                <TableCell className="max-w-[220px]">
                  <TagsCell
                    tags={m.tags}
                    onSave={(tags) => onSaveInline(m.id, { tags })}
                  />
                </TableCell>

                {/* Used in */}
                <TableCell className="max-w-[220px]">
                  <UsedInCell row={m} />
                </TableCell>

                {/* Dimensions */}
                <TableCell className="whitespace-nowrap tabular-nums text-text-secondary">
                  {m.width && m.height ? `${m.width}×${m.height}` : "–"}
                </TableCell>

                {/* Size */}
                <TableCell className="whitespace-nowrap tabular-nums text-text-secondary">
                  {fmtSize(m.bytes) || "–"}
                </TableCell>

                {/* Format */}
                <TableCell className="uppercase text-text-secondary">
                  {m.format ?? "–"}
                </TableCell>

                {/* URL */}
                <TableCell className="max-w-[200px]">
                  <div className="flex items-center gap-1">
                    <span
                      className="truncate text-[12px] text-text-muted"
                      title={m.url}
                    >
                      {m.url}
                    </span>
                    <IconButton
                      label="Copy URL"
                      onClick={() => copyToClipboard(m.url, "URL copied")}
                    >
                      <Copy className="size-3.5" />
                    </IconButton>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in new tab"
                      aria-label="Open image in new tab"
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </TableCell>

                {/* Uploaded */}
                <TableCell
                  className="whitespace-nowrap text-text-secondary"
                  title={m.createdAt ?? ""}
                >
                  {fmtDate(m.createdAt)}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <IconButton
                      label="Copy Markdown"
                      onClick={() =>
                        copyToClipboard(markdownFor(m), "Markdown copied")
                      }
                    >
                      <FileCode2 className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Copy <img> tag"
                      onClick={() =>
                        copyToClipboard(imgTagFor(m), "<img> tag copied")
                      }
                    >
                      <Code2 className="size-4" />
                    </IconButton>
                    <IconButton label="Edit" onClick={() => onEdit(m)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      destructive
                      onClick={() => onDelete(m)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Sortable header ──────────────────────────────────────────────────────────

function SortHead({
  label,
  sortKey,
  current,
  onSort,
  className,
}: {
  label: string;
  sortKey: MediaSort;
  current: MediaSort;
  onSort: (sort: MediaSort) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-pressed={active}
        className={cn(
          "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active && "text-text-primary",
        )}
      >
        {label}
        {active ? (
          <ArrowDown className="size-3.5" aria-hidden="true" />
        ) : (
          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
}

// ── Icon button (title-based tooltip, keyboard accessible) ───────────────────

function IconButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        destructive ? "hover:text-danger" : "hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

// ── Inline alt-text editor ───────────────────────────────────────────────────

function AltCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (alt: string) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next === value.trim()) return;
    // Optimistic save is owned by the parent; roll back the draft on failure.
    try {
      await onSave(next);
    } catch {
      setDraft(value);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        aria-label="Edit alt text"
        placeholder="Describe the image"
        className="h-8 text-[13px]"
      />
    );
  }

  const missing = !value.trim();
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="group/alt flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={missing ? "Add missing alt text" : `Edit alt text: ${value}`}
    >
      {missing ? (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-danger">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          Missing alt
        </span>
      ) : (
        <span className="line-clamp-2 text-[13px] text-text-primary">
          {value}
        </span>
      )}
      <Pencil className="ml-auto size-3 shrink-0 text-text-muted opacity-0 transition-opacity group-hover/alt:opacity-100" />
    </button>
  );
}

// ── Inline tags editor ───────────────────────────────────────────────────────

function TagsCell({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const addTag = async () => {
    const next = draft.trim().toLowerCase();
    setDraft("");
    setAdding(false);
    if (!next || tags.includes(next)) return;
    try {
      await onSave([...tags, next]);
    } catch {
      /* parent rolls back optimistic state + toasts */
    }
  };

  const removeTag = async (tag: string) => {
    try {
      await onSave(tags.filter((t) => t !== tag));
    } catch {
      /* parent rolls back */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Chip key={tag} size="sm" onRemove={() => removeTag(tag)}>
          {tag}
        </Chip>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={addTag}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              void addTag();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft("");
              setAdding(false);
            }
          }}
          aria-label="Add tag"
          placeholder="tag…"
          className="h-6 w-20 rounded-sm border border-border bg-surface px-1.5 text-[12px] text-text-primary focus-visible:border-primary focus-visible:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Add tag"
          className="inline-flex size-5 items-center justify-center rounded-sm border border-dashed border-border text-text-muted transition-colors hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  );
}

// ── Used-in cell ─────────────────────────────────────────────────────────────

function UsedInCell({ row }: { row: SeoMediaRow }) {
  if (row.usageCount === 0) {
    return (
      <Badge variant="neutral" className="gap-1">
        Unused
      </Badge>
    );
  }
  return (
    <ul className="space-y-0.5">
      {row.usedIn.map((ref) => (
        <li key={`${ref.postId}-${ref.where}`}>
          <Link
            href={`/seoteam/${ref.postId}`}
            className="inline-flex max-w-full items-center gap-1.5 text-[13px] text-text-link hover:underline"
            title={ref.title}
          >
            <span className="truncate">{ref.title}</span>
            <span className="shrink-0 rounded bg-surface-alt px-1 py-0.5 text-[10px] uppercase text-text-muted">
              {ref.where}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

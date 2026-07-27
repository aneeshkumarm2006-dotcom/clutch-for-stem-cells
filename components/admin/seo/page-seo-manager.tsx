"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TextField, Label } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import { STATIC_PAGE_GROUPS, type StaticPageGroup } from "@/config/static-pages";
import type { PageSeoPointer, PageSeoRow } from "@/lib/admin/page-seo";

/** Google truncates around these; past them the field turns amber, not invalid. */
const TITLE_SOFT_LIMIT = 60;
const DESCRIPTION_SOFT_LIMIT = 160;

export function PageSeoManager({
  rows,
  pointers,
}: {
  rows: PageSeoRow[];
  pointers: PageSeoPointer[];
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(rows);
  const [saving, setSaving] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(rows),
    [draft, rows],
  );

  const patch = (path: string, changes: Partial<PageSeoRow>) =>
    setDraft((current) =>
      current.map((row) => (row.path === path ? { ...row, ...changes } : row)),
    );

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/page-seo", {
        method: "PATCH",
        body: {
          pageSeo: draft.map((row) => ({
            path: row.path,
            metaTitle: row.metaTitle,
            metaDescription: row.metaDescription,
            noindex: row.noindex,
          })),
        },
      });
      toast.success("Page metadata saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const grouped = STATIC_PAGE_GROUPS.map(
    (group) =>
      [group, draft.filter((row) => row.group === group)] as [
        StaticPageGroup,
        PageSeoRow[],
      ],
  ).filter(([, items]) => items.length > 0);

  return (
    <>
      <PageHeader
        title="Page SEO"
        badge={
          dirty ? (
            <span className="rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-semibold text-warning-fg">
              Unsaved changes
            </span>
          ) : null
        }
        description="Meta titles and descriptions for the fixed pages of the site."
      >
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          Save changes
        </Button>
      </PageHeader>

      <div className="max-w-3xl space-y-4 p-5 lg:p-7">
        <p className="text-[13px] leading-relaxed text-text-muted">
          These pages are built in code, so they have no content record of their
          own. Anything you type here overrides what ships with the site — and
          it is used <strong>exactly as written</strong>, brand suffix included.
          Leave a field blank to keep the built-in copy shown as placeholder
          text.
        </p>

        {grouped.map(([group, items]) => (
          <section
            key={group}
            className="rounded-xl border border-border bg-surface"
          >
            <h2 className="border-b border-border px-5 py-3 font-display text-[15px] font-semibold text-text-primary">
              {group}
            </h2>
            <div className="divide-y divide-slate-100">
              {items.map((row) => (
                <PageRow
                  key={row.path}
                  row={row}
                  onChange={(changes) => patch(row.path, changes)}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-[15px] font-semibold text-text-primary">
            Metadata edited elsewhere
          </h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Every other page stores its own meta title and description on the
            record behind it.
          </p>
          <div className="mt-3 grid gap-0.5">
            {pointers.map((pointer) => (
              <Link
                key={pointer.href}
                href={pointer.href}
                className="flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-surface-alt"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-text-primary">
                    {pointer.label}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {pointer.description}
                  </div>
                </div>
                <ArrowUpRight className="mt-0.5 size-3.5 flex-none text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function PageRow({
  row,
  onChange,
}: {
  row: PageSeoRow;
  onChange: (changes: Partial<PageSeoRow>) => void;
}) {
  const overridden = Boolean(row.metaTitle || row.metaDescription);
  const effectiveTitle = row.metaTitle || row.defaultTitle;
  const effectiveDescription = row.metaDescription || row.defaultDescription;

  return (
    <div className="space-y-3.5 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-text-primary">
            {row.label}
          </div>
          <Link
            href={row.path}
            target="_blank"
            className="text-[12.5px] text-text-muted hover:text-azure-700"
          >
            {row.path}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {overridden ? (
            <>
              <span className="rounded-md bg-tint px-1.5 py-0.5 text-[11px] font-semibold text-azure-700">
                Overridden
              </span>
              <button
                type="button"
                onClick={() => onChange({ metaTitle: "", metaDescription: "" })}
                className="flex items-center gap-1 text-[12px] text-text-muted hover:text-text-secondary"
              >
                <RotateCcw className="size-3" />
                Reset
              </button>
            </>
          ) : null}
        </div>
      </div>

      <TextField
        label="Meta title"
        value={row.metaTitle}
        onChange={(e) => onChange({ metaTitle: e.target.value })}
        placeholder={row.defaultTitle}
        hint={counterHint(effectiveTitle, TITLE_SOFT_LIMIT)}
      />

      <div className="space-y-1.5">
        <Label>Meta description</Label>
        <Textarea
          rows={3}
          value={row.metaDescription}
          onChange={(e) => onChange({ metaDescription: e.target.value })}
          placeholder={row.defaultDescription}
        />
        <p
          className={cn(
            "text-[12px]",
            effectiveDescription.length > DESCRIPTION_SOFT_LIMIT
              ? "text-warning-fg"
              : "text-text-muted",
          )}
        >
          {counterHint(effectiveDescription, DESCRIPTION_SOFT_LIMIT)}
        </p>
      </div>

      <label className="flex items-center justify-between py-1">
        <span className="text-[13px] text-text-secondary">
          Hide from search engines (noindex)
        </span>
        <Toggle
          checked={row.noindex}
          onCheckedChange={(on) => onChange({ noindex: on })}
          label={`noindex ${row.path}`}
        />
      </label>
    </div>
  );
}

function counterHint(value: string, limit: number): string {
  const over = value.length - limit;
  return over > 0
    ? `${value.length} characters — ${over} over the ~${limit} Google usually shows`
    : `${value.length} / ~${limit} characters`;
}

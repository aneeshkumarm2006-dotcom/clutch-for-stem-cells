"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TextField,
  TextareaField,
  SelectField,
  Label,
} from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { BlockEditor } from "@/components/blocks/block-editor";
import { ContentFlagWarning } from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { blocksScanText } from "@/lib/blocks/content";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { cn } from "@/lib/utils";
import { CONTENT_ENGINE } from "@/config/content-engine";
import { TWITTER_CARD_TYPES, type TwitterCardType } from "@/lib/enums";
import type {
  EditablePage,
  EditablePageDefaults,
} from "@/config/editable-pages";
import type { PageSeoView } from "@/lib/admin/page-content";
import type { BlockInput } from "@/lib/validation/block";

/**
 * The site-page editor.
 *
 * Every field is an *override*: the shipped string is the placeholder, and
 * clearing a field puts it back. That is the whole interaction model, and it is
 * why there is no "delete page" here and no draft state. These routes exist
 * whether or not anyone has edited them, so the only two states are "shipped
 * copy" and "shipped copy with your changes on top".
 *
 * Blocks are the exception to the placeholder rule, because a composition can't
 * be a placeholder: the editor loads the shipped blocks and edits them in place.
 * Emptying the list restores the shipped composition rather than blanking the
 * body, which matters most on the legal pages nobody wants accidentally cleared.
 *
 * The meta block follows the same override model but lands in a different
 * store — `SiteSetting.pageSeo`, which `/admin/seo` also writes — so the two
 * screens are two views of one title tag rather than competing copies. A
 * variant page gets no meta block at all: it renders under its parent's URL and
 * has no metadata of its own.
 */

/** Google truncates around these; past them the counter turns amber, not invalid. */
const TITLE_SOFT_LIMIT = 60;
const DESCRIPTION_SOFT_LIMIT = 160;

interface StoredValues {
  title: string;
  lead: string;
  updated: string;
  legalReview: boolean | null;
  blocks: BlockInput[];
  blocksAfter: BlockInput[];
  extras: Record<string, string>;
}

export interface SitePageSeo {
  stored: PageSeoView;
  defaults: { title: string; description: string };
}

/** Every meta field cleared — what "reset" leaves behind. */
const BLANK_SEO: PageSeoView = {
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

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-sm font-semibold text-text-primary">
        {title}
      </h2>
      {hint ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function SitePageForm({
  entry,
  defaults,
  stored,
  seo,
}: {
  entry: EditablePage;
  defaults: EditablePageDefaults;
  stored: StoredValues;
  /** `null` for a variant page, which has no metadata of its own. */
  seo: SitePageSeo | null;
}) {
  const router = useRouter();
  const [v, setV] = React.useState<StoredValues>(stored);
  const [s, setS] = React.useState<PageSeoView | null>(seo?.stored ?? null);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const dirty = React.useMemo(
    () =>
      JSON.stringify([v, s]) !== JSON.stringify([stored, seo?.stored ?? null]),
    [v, s, stored, seo],
  );

  const set = (patch: Partial<StoredValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

  // Guarded rather than null-checked at every call site: the meta panel only
  // renders when there is meta to edit, so a patch with none is a no-op.
  const setSeo = (patch: Partial<PageSeoView>) =>
    setS((cur) => (cur ? { ...cur, ...patch } : cur));

  // Live cure/guarantee scan, same rules the /seoteam editors run. The server
  // does not gate saves here (these are admin-owned routes, not authored
  // pages), so this is advisory rather than blocking.
  const flags = React.useMemo(
    () =>
      findFlaggedPhrases([
        v.title,
        v.lead,
        blocksScanText(v.blocks),
        blocksScanText(v.blocksAfter),
        ...Object.values(v.extras),
        s?.metaTitle ?? "",
        s?.metaDescription ?? "",
      ]),
    [v, s],
  );

  const apiPath = `/api/admin/page-content${entry.path}`;

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch(apiPath, {
        method: "PATCH",
        body: {
          title: v.title,
          lead: v.lead,
          ...(entry.hasUpdated ? { updated: v.updated } : {}),
          ...(entry.hasLegalReview ? { legalReview: v.legalReview } : {}),
          ...(entry.hasBlocks ? { blocks: v.blocks } : {}),
          ...(entry.hasBlocksAfter ? { blocksAfter: v.blocksAfter } : {}),
          extras: v.extras,
          ...(s
            ? {
                seo: {
                  metaTitle: s.metaTitle,
                  metaDescription: s.metaDescription,
                  ogTitle: s.ogTitle,
                  ogDescription: s.ogDescription,
                  ogImage: s.ogImage,
                  canonicalUrl: s.canonicalUrl,
                  // A blank is "inherit the site default", which the schema
                  // spells `undefined` rather than an empty enum value.
                  twitterCard: s.twitterCard || undefined,
                  focusKeyword: s.focusKeyword,
                  noindex: s.noindex,
                  robots:
                    s.follow === undefined ? undefined : { follow: s.follow },
                },
              }
            : {}),
        },
      });
      toast.success("Saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      await adminFetch(apiPath, { method: "DELETE" });
      // `router.refresh()` re-renders the server component but does not remount
      // this one, so the form would otherwise keep showing the values that were
      // just deleted — and re-save them on the next click.
      setV({
        title: "",
        lead: "",
        updated: "",
        legalReview: null,
        blocks: defaults.blocks,
        blocksAfter: defaults.blocksAfter,
        extras: Object.fromEntries(entry.extras.map((e) => [e.key, ""])),
      });
      setS((cur) => (cur ? BLANK_SEO : cur));
      toast.success("Restored the shipped copy");
      setConfirmReset(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={{ label: "Site pages", href: "/admin/content/site-pages" }}
        title={entry.label}
        badge={dirty ? <Badge variant="neutral">Unsaved changes</Badge> : null}
        description={entry.variantWhen ?? entry.path}
      >
        {!entry.variantOf ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={entry.path} target="_blank">
              View
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmReset(true)}
          disabled={resetting}
        >
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </PageHeader>

      <div className="max-w-3xl space-y-5 p-5 lg:p-7">
        <ContentFlagWarning flags={flags} />

        <Panel
          title="Headline"
          hint="Leave a field blank to use the copy the site shipped with, shown as the placeholder."
        >
          <TextField
            label="Title"
            hint={entry.notes.title}
            value={v.title}
            placeholder={defaults.title}
            onChange={(e) => set({ title: e.target.value })}
          />
          <TextareaField
            label="Intro"
            rows={3}
            hint={`${entry.notes.lead} Basic HTML is allowed, so <a href="/contact">links</a> work.`}
            value={v.lead}
            placeholder={defaults.lead || "No intro paragraph on this page."}
            onChange={(e) => set({ lead: e.target.value })}
          />
          {entry.hasUpdated ? (
            <TextField
              label="Last updated"
              hint="Printed under the intro. Blank hides the line."
              value={v.updated}
              placeholder={defaults.updated || "Not shown"}
              onChange={(e) => set({ updated: e.target.value })}
            />
          ) : null}
          {entry.hasLegalReview ? (
            <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-alt px-4 py-3">
              <div>
                <Label>Legal-review notice</Label>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
                  Shows the amber &ldquo;placeholder content, flagged for review
                  by a qualified professional&rdquo; banner. Turn it off once
                  this page has been signed off.
                </p>
              </div>
              <Toggle
                checked={v.legalReview ?? defaults.legalReview}
                onCheckedChange={(legalReview) => set({ legalReview })}
                label="Show the legal-review notice"
              />
            </div>
          ) : null}
        </Panel>

        {entry.extras.length ? (
          <Panel title="Page copy">
            {entry.extras.map((extra) =>
              extra.multiline ? (
                <TextareaField
                  key={extra.key}
                  label={extra.label}
                  hint={extra.hint}
                  rows={2}
                  value={v.extras[extra.key] ?? ""}
                  placeholder={extra.value}
                  onChange={(e) =>
                    set({ extras: { ...v.extras, [extra.key]: e.target.value } })
                  }
                />
              ) : (
                <TextField
                  key={extra.key}
                  label={extra.label}
                  hint={extra.hint}
                  value={v.extras[extra.key] ?? ""}
                  placeholder={extra.value}
                  onChange={(e) =>
                    set({ extras: { ...v.extras, [extra.key]: e.target.value } })
                  }
                />
              ),
            )}
          </Panel>
        ) : null}

        {entry.hasBlocks ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Body
              </h2>
              <p className="text-[12px] text-text-muted">
                {entry.notes.blocks}
              </p>
            </div>
            <BlockEditor
              value={v.blocks}
              onChange={(blocks) => set({ blocks })}
              enabledTypes={CONTENT_ENGINE.blocks}
            />
          </div>
        ) : null}

        {entry.hasBlocksAfter ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Lower body
              </h2>
              <p className="text-[12px] text-text-muted">
                {entry.notes.blocksAfter}
              </p>
            </div>
            <BlockEditor
              value={v.blocksAfter}
              onChange={(blocksAfter) => set({ blocksAfter })}
              enabledTypes={CONTENT_ENGINE.blocks}
            />
          </div>
        ) : null}

        {s && seo ? (
          <SeoPanel
            path={entry.path}
            note={entry.notes.seo}
            value={s}
            defaults={seo.defaults}
            onChange={setSeo}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restore the shipped copy?"
        description={`Every override on ${entry.path}, meta included, is deleted and the page goes back to the text it shipped with. This cannot be undone.`}
        confirmLabel="Restore"
        destructive
        onConfirm={reset}
      />
    </div>
  );
}

/**
 * The route's meta. Same override model as the copy above it — the shipped
 * string is the placeholder and clearing a field restores it — but stored in
 * `SiteSetting.pageSeo`, which is why the link out to `/admin/seo` matters:
 * that screen is the same values in a list, for comparing pages side by side.
 */
function SeoPanel({
  path,
  note,
  value,
  defaults,
  onChange,
}: {
  path: string;
  /** Set where the route's code already decides part of its indexation. */
  note?: string;
  value: PageSeoView;
  defaults: { title: string; description: string };
  onChange: (patch: Partial<PageSeoView>) => void;
}) {
  const effectiveTitle = value.metaTitle || defaults.title;
  const effectiveDescription = value.metaDescription || defaults.description;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-text-primary">
          SEO &amp; meta
        </h2>
        <Link
          href="/admin/seo"
          className="text-[12px] text-text-muted hover:text-text-secondary"
        >
          Compare every page
        </Link>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
        What search engines and social cards show for {path}. Blank means the
        copy the site shipped with. Titles are used verbatim, brand suffix
        included, with two house rules applied on save: no em dashes, and
        <strong> |</strong> is the only separator symbol.
      </p>
      {note ? (
        <p className="mt-2 rounded-lg bg-surface-alt px-3 py-2 text-[12.5px] leading-relaxed text-text-secondary">
          {note}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        <TextField
          label="Meta title"
          placeholder={defaults.title}
          value={value.metaTitle}
          labelAccessory={
            <Counter value={effectiveTitle} limit={TITLE_SOFT_LIMIT} />
          }
          onChange={(e) => onChange({ metaTitle: e.target.value })}
        />
        <TextareaField
          label="Meta description"
          rows={3}
          placeholder={defaults.description}
          value={value.metaDescription}
          labelAccessory={
            <Counter
              value={effectiveDescription}
              limit={DESCRIPTION_SOFT_LIMIT}
            />
          }
          onChange={(e) => onChange({ metaDescription: e.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="OG title"
            hint="Falls back to the meta title."
            value={value.ogTitle}
            onChange={(e) => onChange({ ogTitle: e.target.value })}
          />
          <TextField
            label="OG image URL"
            hint="Falls back to the site default."
            value={value.ogImage}
            onChange={(e) => onChange({ ogImage: e.target.value })}
          />
        </div>
        <TextareaField
          label="OG description"
          rows={2}
          hint="Falls back to the meta description."
          value={value.ogDescription}
          onChange={(e) => onChange({ ogDescription: e.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Canonical URL"
            hint="Full URL. Blank means the page's own address."
            value={value.canonicalUrl}
            onChange={(e) => onChange({ canonicalUrl: e.target.value })}
          />
          <SelectField
            label="Twitter card"
            options={[
              // A Radix select item can't carry an empty value, so "inherit"
              // stands in for "nothing stored".
              { value: "inherit", label: "Site default" },
              ...TWITTER_CARD_TYPES.map((t) => ({ value: t, label: t })),
            ]}
            value={value.twitterCard || "inherit"}
            onValueChange={(raw) =>
              onChange({
                twitterCard:
                  raw === "inherit" ? "" : (raw as TwitterCardType),
              })
            }
          />
        </div>

        <TextField
          label="Focus keyword"
          hint="Editorial only. Never emitted."
          value={value.focusKeyword}
          onChange={(e) => onChange({ focusKeyword: e.target.value })}
        />

        <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-alt px-4 py-3">
          <div>
            <Label>Hide from search engines</Label>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
              Adds noindex, so the page drops out of search results.
            </p>
          </div>
          <Toggle
            checked={value.noindex}
            onCheckedChange={(noindex) => onChange({ noindex })}
            label={`noindex ${path}`}
          />
        </div>

        <SelectField
          label="Link following"
          hint="Whether crawlers follow the links on this page."
          options={[
            { value: "inherit", label: "Inherit (follow)" },
            { value: "follow", label: "Follow" },
            { value: "nofollow", label: "Nofollow" },
          ]}
          value={
            value.follow === undefined
              ? "inherit"
              : value.follow
                ? "follow"
                : "nofollow"
          }
          onValueChange={(raw) =>
            onChange({
              follow: raw === "inherit" ? undefined : raw === "follow",
            })
          }
        />
      </div>
    </section>
  );
}

function Counter({ value, limit }: { value: string; limit: number }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "text-[12px] tabular-nums",
        value.length > limit ? "text-warning-fg" : "text-text-muted",
      )}
    >
      {value.length}/{limit}
    </span>
  );
}

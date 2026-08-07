"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TextField, TextareaField, Label } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { BlockEditor } from "@/components/blocks/block-editor";
import { ContentFlagWarning } from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { blocksScanText } from "@/lib/blocks/content";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { CONTENT_ENGINE } from "@/config/content-engine";
import type {
  EditablePage,
  EditablePageDefaults,
} from "@/config/editable-pages";
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
 */

interface StoredValues {
  title: string;
  lead: string;
  updated: string;
  legalReview: boolean | null;
  blocks: BlockInput[];
  blocksAfter: BlockInput[];
  extras: Record<string, string>;
}

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
}: {
  entry: EditablePage;
  defaults: EditablePageDefaults;
  stored: StoredValues;
}) {
  const router = useRouter();
  const [v, setV] = React.useState<StoredValues>(stored);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(v) !== JSON.stringify(stored),
    [v, stored],
  );

  const set = (patch: Partial<StoredValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

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
      ]),
    [v],
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
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restore the shipped copy?"
        description={`Every override on ${entry.path} is deleted and the page goes back to the text it shipped with. This cannot be undone.`}
        confirmLabel="Restore"
        destructive
        onConfirm={reset}
      />
    </div>
  );
}

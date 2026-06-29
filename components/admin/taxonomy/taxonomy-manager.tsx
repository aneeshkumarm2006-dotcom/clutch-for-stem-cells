"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TextField, SelectField, Label } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { LOCATION_KINDS } from "@/lib/enums";
import type { AdminTaxonomyRow, TaxonomyView } from "@/lib/admin/taxonomy";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  parentId?: string;
  category?: string;
  issuingBody?: string;
  kind?: string;
  countryCode?: string;
  region?: string;
  flag?: string;
  lat?: string;
  lng?: string;
  shortDescription?: string;
  description?: string;
  icon?: string;
  isActive: boolean;
}

function blank(isLocation: boolean): FormState {
  return {
    name: "",
    slug: "",
    isActive: true,
    kind: isLocation ? "country" : undefined,
  };
}

function fromRow(r: AdminTaxonomyRow): FormState {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parentId,
    category: r.category ?? "",
    issuingBody: r.issuingBody ?? "",
    kind: r.kind,
    countryCode: r.countryCode ?? "",
    region: r.region ?? "",
    flag: r.flag ?? "",
    lat: r.lat != null ? String(r.lat) : "",
    lng: r.lng != null ? String(r.lng) : "",
    shortDescription: r.shortDescription ?? "",
    description: r.description ?? "",
    icon: r.icon ?? "",
    isActive: r.isActive,
  };
}

export function TaxonomyManager({ view }: { view: TaxonomyView }) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(blank(view.isLocation));
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Reset editor when switching taxonomy kind.
  React.useEffect(() => {
    setForm(blank(view.isLocation));
    setSlugTouched(false);
  }, [view.segment, view.isLocation]);

  const base = `/api/admin/taxonomy/${view.segment}`;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const selectRow = (r: AdminTaxonomyRow) => {
    setForm(fromRow(r));
    setSlugTouched(true);
  };
  const startCreate = () => {
    setForm(blank(view.isLocation));
    setSlugTouched(false);
  };

  const onName = (name: string) =>
    set({ name, slug: slugTouched ? form.slug : slugify(name) });

  const buildPayload = () => {
    const num = (v?: string) =>
      v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
    const payload: Record<string, unknown> = {
      name: form.name,
      slug: form.slug,
      parentId: form.parentId || undefined,
      shortDescription: form.shortDescription || undefined,
      description: form.description || undefined,
      icon: form.icon || undefined,
      isActive: form.isActive,
    };
    if (view.hasCategory) payload.category = form.category || undefined;
    if (view.hasIssuingBody) payload.issuingBody = form.issuingBody || undefined;
    if (view.isLocation) {
      payload.kind = form.kind || "country";
      payload.countryCode = form.countryCode || undefined;
      payload.region = form.region || undefined;
      payload.flag = form.flag || undefined;
      payload.lat = num(form.lat);
      payload.lng = num(form.lng);
    }
    return payload;
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        await adminFetch(`${base}/${form.id}`, {
          method: "PATCH",
          body: buildPayload(),
        });
        toast.success("Saved");
      } else {
        await adminFetch(base, { method: "POST", body: buildPayload() });
        toast.success(`${view.singular} created`);
        startCreate();
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: AdminTaxonomyRow) => {
    try {
      await adminFetch(`${base}/${r.id}`, {
        method: "PATCH",
        body: { isActive: !r.isActive },
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    }
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= view.rows.length) return;
    const ids = view.rows.map((r) => r.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await adminFetch(`${base}/reorder`, { method: "POST", body: { ids } });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder.");
    }
  };

  return (
    <>
      <PageHeader title={view.label}>
        <Button size="sm" onClick={startCreate}>
          <Plus className="size-4" />
          Add {view.singular}
        </Button>
      </PageHeader>

      <div className="flex flex-col items-start gap-5 p-5 lg:flex-row lg:p-7">
        {/* List */}
        <div className="w-full flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[28px_1fr_70px_56px_40px] items-center gap-2 border-b border-border bg-surface-alt px-3.5 py-2.5 text-[12px] font-semibold text-text-secondary">
            <span />
            <span>Name</span>
            <span>Clinics</span>
            <span>Active</span>
            <span />
          </div>
          {view.rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              No {view.label.toLowerCase()} yet.
            </p>
          ) : (
            view.rows.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[28px_1fr_70px_56px_40px] items-center gap-2 border-b border-slate-100 px-3.5 py-3 last:border-0",
                  form.id === r.id && "bg-background",
                )}
              >
                <div className="flex flex-col text-text-muted">
                  <button
                    type="button"
                    onClick={() => reorder(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="disabled:opacity-30"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder(i, 1)}
                    disabled={i === view.rows.length - 1}
                    aria-label="Move down"
                    className="disabled:opacity-30"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => selectRow(r)}
                  className="min-w-0 text-left"
                >
                  <div className="truncate text-sm font-semibold text-text-primary">
                    {r.name}
                  </div>
                  <div className="truncate text-xs text-text-muted">
                    /{view.segment}/{r.slug}
                  </div>
                </button>
                <span className="text-[13px] text-text-secondary">
                  {r.clinicCount}
                </span>
                <Toggle
                  checked={r.isActive}
                  onCheckedChange={() => toggleActive(r)}
                  label={`Active: ${r.name}`}
                />
                <GripVertical className="size-4 text-border-strong" />
              </div>
            ))
          )}
        </div>

        {/* Editor panel */}
        <div className="w-full flex-none rounded-xl border border-border bg-surface p-5 lg:w-[360px]">
          <div className="mb-4 font-display text-base font-semibold">
            {form.id ? `Edit ${view.singular}` : `New ${view.singular}`}
          </div>
          <div className="space-y-3.5">
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => onName(e.target.value)}
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set({ slug: e.target.value });
              }}
            />
            {view.hasCategory ? (
              <TextField
                label="Category group"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              />
            ) : null}
            {view.hasIssuingBody ? (
              <TextField
                label="Issuing body"
                value={form.issuingBody}
                onChange={(e) => set({ issuingBody: e.target.value })}
              />
            ) : null}
            {view.isLocation ? (
              <>
                <SelectField
                  label="Kind"
                  options={LOCATION_KINDS.map((k) => ({ value: k, label: k }))}
                  value={form.kind}
                  onValueChange={(v) => set({ kind: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Country code"
                    value={form.countryCode}
                    onChange={(e) => set({ countryCode: e.target.value })}
                  />
                  <TextField
                    label="Flag emoji"
                    value={form.flag}
                    onChange={(e) => set({ flag: e.target.value })}
                  />
                  <TextField
                    label="Latitude"
                    type="number"
                    value={form.lat}
                    onChange={(e) => set({ lat: e.target.value })}
                  />
                  <TextField
                    label="Longitude"
                    type="number"
                    value={form.lng}
                    onChange={(e) => set({ lng: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            {view.parentOptions.filter((o) => o.value !== form.id).length > 0 ? (
              <SelectField
                label="Parent group"
                placeholder="None"
                options={view.parentOptions.filter((o) => o.value !== form.id)}
                value={form.parentId}
                onValueChange={(v) => set({ parentId: v })}
              />
            ) : null}
            <div className="space-y-1.5">
              <Label>SEO description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Intro copy shown on this term's directory page."
              />
            </div>
            <TextField
              label="Icon (Lucide name)"
              value={form.icon}
              onChange={(e) => set({ icon: e.target.value })}
              placeholder="Activity"
            />
            <label className="flex items-center justify-between py-1">
              <span className="text-[13.5px] font-semibold text-slate-700">
                Active
              </span>
              <Toggle
                checked={form.isActive}
                onCheckedChange={(c) => set({ isActive: c })}
                label="Active"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={save} disabled={busy}>
                {form.id ? "Save changes" : `Create ${view.singular}`}
              </Button>
              {form.id ? (
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${view.singular}`}
        description={`Delete "${form.name}"? Terms still used by clinics can't be deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!form.id) return;
          try {
            await adminFetch(`${base}/${form.id}`, { method: "DELETE" });
            toast.success("Deleted");
            startCreate();
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField, TextareaField, SelectField, Label } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { TagInput } from "@/components/admin/tag-input";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import { PLAN_KEYS, SUPPORTED_CURRENCIES } from "@/lib/enums";
import type { AdminPlanRow } from "@/lib/admin/plans";

type PlanDraft = Partial<AdminPlanRow> & { features: string[] };

function emptyPlan(): PlanDraft {
  return {
    key: "basic",
    name: "",
    currency: "USD",
    features: [],
    highlighted: false,
    isActive: true,
    order: 0,
  };
}

export function PlansManager({ plans }: { plans: AdminPlanRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<PlanDraft | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<AdminPlanRow | null>(null);

  return (
    <>
      <PageHeader title="Plans">
        <Button size="sm" onClick={() => setEditing(emptyPlan())}>
          <Plus className="size-4" />
          Add plan
        </Button>
      </PageHeader>

      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 lg:p-7">
        {plans.length === 0 ? (
          <p className="text-sm text-text-muted">No plans yet.</p>
        ) : (
          plans.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-xl border border-border bg-surface p-5"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-display text-lg font-semibold">
                  {p.name}
                </span>
                {p.badge ? <Badge variant="featured">{p.badge}</Badge> : null}
              </div>
              <div className="mb-3 text-[13px] text-text-muted">
                {p.priceMonthly != null
                  ? `${p.currency} ${p.priceMonthly}/mo`
                  : "Custom pricing"}
              </div>
              <ul className="mb-4 flex-1 space-y-1.5 text-[13px] text-text-secondary">
                {p.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 size-3.5 flex-none text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between">
                <Badge variant={p.isActive ? "success" : "neutral"}>
                  {p.isActive ? "Active" : "Inactive"}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing({ ...p })}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeleteFor(p)}
                    aria-label="Delete plan"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <PlanDialog
        draft={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title="Delete plan"
        description={deleteFor ? `Delete the "${deleteFor.name}" plan?` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteFor) return;
          try {
            await adminFetch(`/api/admin/plans/${deleteFor.id}`, {
              method: "DELETE",
            });
            toast.success("Plan deleted");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}

function PlanDialog({
  draft,
  onOpenChange,
  onSaved,
}: {
  draft: PlanDraft | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [v, setV] = React.useState<PlanDraft>(draft ?? emptyPlan());
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (draft) setV(draft);
  }, [draft]);

  const set = (patch: Partial<PlanDraft>) => setV((c) => ({ ...c, ...patch }));
  const isEdit = Boolean(draft?.id);

  const save = async () => {
    if (!v.name?.trim()) {
      toast.error("Name is required.");
      return;
    }
    const body = {
      key: v.key,
      name: v.name,
      description: v.description || undefined,
      priceMonthly:
        v.priceMonthly === undefined || v.priceMonthly === null
          ? undefined
          : Number(v.priceMonthly),
      priceYearly:
        v.priceYearly === undefined || v.priceYearly === null
          ? undefined
          : Number(v.priceYearly),
      currency: v.currency,
      features: v.features,
      badge: v.badge || undefined,
      ctaLabel: v.ctaLabel || undefined,
      highlighted: v.highlighted,
      isActive: v.isActive,
      order: Number(v.order) || 0,
    };
    setBusy(true);
    try {
      if (isEdit) {
        await adminFetch(`/api/admin/plans/${draft!.id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await adminFetch("/api/admin/plans", { method: "POST", body });
      }
      toast.success("Plan saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <SelectField
            label="Key"
            options={PLAN_KEYS.map((k) => ({ value: k, label: k }))}
            value={v.key}
            onValueChange={(key) => set({ key: key as AdminPlanRow["key"] })}
            disabled={isEdit}
          />
          <TextField
            label="Name"
            value={v.name ?? ""}
            onChange={(e) => set({ name: e.target.value })}
          />
          <TextareaField
            label="Description"
            rows={2}
            value={v.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Monthly"
              type="number"
              value={v.priceMonthly ?? ""}
              onChange={(e) =>
                set({
                  priceMonthly: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
            <TextField
              label="Yearly"
              type="number"
              value={v.priceYearly ?? ""}
              onChange={(e) =>
                set({
                  priceYearly: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
            <SelectField
              label="Currency"
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
              value={v.currency}
              onValueChange={(currency) => set({ currency })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Features</Label>
            <TagInput
              value={v.features}
              onChange={(features) => set({ features })}
              placeholder="Add a feature…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Badge"
              value={v.badge ?? ""}
              onChange={(e) => set({ badge: e.target.value })}
            />
            <TextField
              label="CTA label"
              value={v.ctaLabel ?? ""}
              onChange={(e) => set({ ctaLabel: e.target.value })}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
              <Toggle
                checked={Boolean(v.highlighted)}
                onCheckedChange={(highlighted) => set({ highlighted })}
                label="Highlighted"
              />
              Highlighted
            </label>
            <label className="flex items-center gap-2 text-[13.5px] text-text-secondary">
              <Toggle
                checked={Boolean(v.isActive)}
                onCheckedChange={(isActive) => set({ isActive })}
                label="Active"
              />
              Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

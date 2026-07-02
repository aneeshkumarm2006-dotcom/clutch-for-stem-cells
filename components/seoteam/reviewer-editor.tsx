"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import { ImageField, type ImageValue } from "@/components/seoteam/image-field";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";

export interface ReviewerEditorValues {
  name: string;
  slug: string;
  credentials: string;
  title: string;
  bio: string;
  photo?: ImageValue;
  sameAs: string[];
  isActive: boolean;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 font-display text-sm font-semibold text-text-primary">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function ReviewerEditor({
  mode,
  reviewerId,
  initial,
}: {
  mode: "create" | "edit";
  reviewerId?: string;
  initial: ReviewerEditorValues;
}) {
  const router = useRouter();
  const [v, setV] = React.useState<ReviewerEditorValues>(initial);
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<ReviewerEditorValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

  const onName = (name: string) =>
    set({ name, slug: slugTouched ? v.slug : slugify(name) });

  const save = async () => {
    if (!v.name.trim() || !v.slug.trim()) {
      return toast.error("Name and slug are required.");
    }
    const payload = {
      name: v.name.trim(),
      slug: v.slug.trim(),
      credentials: v.credentials.trim() || undefined,
      title: v.title.trim() || undefined,
      bio: v.bio.trim() || undefined,
      photo: v.photo?.url ? v.photo : undefined,
      sameAs: v.sameAs.map((s) => s.trim()).filter(Boolean),
      isActive: v.isActive,
    };
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/seoteam/reviewers", {
          method: "POST",
          body: payload,
        });
        toast.success("Reviewer added");
        router.push(`/seoteam/reviewers/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/seoteam/reviewers/${reviewerId}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Saved");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/seoteam/reviewers"
            className="hidden text-[13px] text-text-muted hover:text-text-secondary sm:inline"
          >
            Reviewers /
          </Link>
          <h1 className="truncate font-display text-base font-bold text-text-primary lg:text-lg">
            {mode === "create" ? "New reviewer" : v.name || "Reviewer"}
          </h1>
        </div>
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-start gap-5 p-4 lg:flex-row lg:p-6">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rev-name">Full name</Label>
                <Input
                  id="rev-name"
                  value={v.name}
                  onChange={(e) => onName(e.target.value)}
                  placeholder="Dr Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rev-slug">URL slug</Label>
                <Input
                  id="rev-slug"
                  value={v.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: slugify(e.target.value) });
                  }}
                  placeholder="jane-doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rev-credentials">Credentials</Label>
                <Input
                  id="rev-credentials"
                  value={v.credentials}
                  onChange={(e) => set({ credentials: e.target.value })}
                  placeholder="MD, PhD"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rev-title">Title / role</Label>
                <Input
                  id="rev-title"
                  value={v.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="Regenerative Medicine Physician"
                />
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="rev-bio">Bio</Label>
              <Textarea
                id="rev-bio"
                rows={5}
                value={v.bio}
                onChange={(e) => set({ bio: e.target.value })}
                placeholder="Background, specialty, and what they review."
              />
            </div>
          </div>

          <SameAsRepeater
            value={v.sameAs}
            onChange={(sameAs) => set({ sameAs })}
          />
        </div>

        <div className="w-full flex-none space-y-4 lg:w-72">
          <Panel title="Photo">
            <ImageField value={v.photo} onChange={(photo) => set({ photo })} />
          </Panel>
          <Panel title="Status">
            <label className="flex items-center gap-2 text-[13px] text-text-secondary">
              <input
                type="checkbox"
                checked={v.isActive}
                onChange={(e) => set({ isActive: e.target.checked })}
              />
              Active (can be assigned + shown publicly)
            </label>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SameAsRepeater({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-sm font-semibold text-text-primary">
          Profile links (sameAs)
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...value, ""])}
        >
          <Plus className="size-4" /> Add link
        </Button>
      </div>
      <div className="space-y-2">
        {value.length ? (
          value.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={url}
                onChange={(e) =>
                  onChange(value.map((u, j) => (j === i ? e.target.value : u)))
                }
                placeholder="https://registry / ORCID / LinkedIn"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-alt hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-[13px] text-text-muted">
            Add authoritative profile URLs (medical registry, ORCID) for
            E-E-A-T.
          </p>
        )}
      </div>
    </div>
  );
}

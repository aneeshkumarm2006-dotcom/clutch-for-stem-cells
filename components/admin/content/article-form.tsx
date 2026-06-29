"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TextField, TextareaField, SelectField, Label } from "@/components/ui/form-field";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { ImagePicker } from "@/components/admin/image-picker";
import { MultiSelect, type MultiOption } from "@/components/admin/multi-select";
import { TagInput } from "@/components/admin/tag-input";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { ARTICLE_STATUSES } from "@/lib/enums";
import type { ImageView } from "@/lib/admin/serialize";

export interface ArticleFormValues {
  title: string;
  slug: string;
  status: string;
  excerpt?: string;
  body?: string;
  coverImage?: ImageView;
  author: { name?: string; bio?: string; avatar?: ImageView };
  categories: string[];
  tags: string[];
  relatedConditionIds: string[];
  relatedTreatmentIds: string[];
  publishedAt?: string;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    canonicalUrl?: string;
    noindex?: boolean;
  };
}

export function emptyArticle(): ArticleFormValues {
  return {
    title: "",
    slug: "",
    status: "draft",
    excerpt: "",
    body: "",
    author: { name: "" },
    categories: [],
    tags: [],
    relatedConditionIds: [],
    relatedTreatmentIds: [],
    seo: {},
  };
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ArticleForm({
  mode,
  articleId,
  slug: existingSlug,
  defaultValues,
  options,
}: {
  mode: "create" | "edit";
  articleId?: string;
  slug?: string;
  defaultValues: ArticleFormValues;
  options: { conditions: MultiOption[]; treatments: MultiOption[] };
}) {
  const router = useRouter();
  const [v, setV] = React.useState<ArticleFormValues>(defaultValues);
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [publishAt, setPublishAt] = React.useState(
    toLocalInput(defaultValues.publishedAt),
  );
  const [saving, setSaving] = React.useState(false);

  const set = (patch: Partial<ArticleFormValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

  const onTitle = (title: string) =>
    set({ title, slug: slugTouched ? v.slug : slugify(title) });

  const submit = async (status: string) => {
    if (!v.title.trim() || !v.slug.trim()) {
      toast.error("Title and slug are required.");
      return;
    }
    const payload = {
      ...v,
      status,
      author: v.author.name?.trim() ? v.author : undefined,
      publishedAt: publishAt ? new Date(publishAt).toISOString() : undefined,
    };
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/admin/articles", {
          method: "POST",
          body: payload,
        });
        toast.success("Article created");
        router.push(`/admin/content/articles/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/admin/articles/${articleId}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Changes saved");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <PageHeader
        title={mode === "create" ? "New article" : v.title || "Article"}
        breadcrumb={{ label: "Articles", href: "/admin/content/articles" }}
        badge={
          <Badge variant={v.status === "published" ? "success" : "neutral"}>
            {v.status}
          </Badge>
        }
      >
        {mode === "edit" && existingSlug ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/resources/${existingSlug}`} target="_blank">
              <Eye className="size-4" />
              Preview
            </Link>
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => submit("draft")}
        >
          Save as draft
        </Button>
        <Button size="sm" disabled={saving} onClick={() => submit("published")}>
          Publish
        </Button>
      </PageHeader>

      <div className="flex flex-col items-start gap-5 p-5 lg:flex-row lg:p-7">
        {/* Editor */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <ImagePicker
              label="Cover image"
              value={v.coverImage}
              onChange={(img) => set({ coverImage: img })}
              folder="articles"
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <input
              value={v.title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Article title"
              className="mb-3 w-full border-none font-display text-2xl font-bold tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-muted"
            />
            <div className="mb-3 space-y-1.5">
              <Label htmlFor="article-slug">Slug</Label>
              <Input
                id="article-slug"
                value={v.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: e.target.value });
                }}
              />
            </div>
            <TextareaField
              label="Excerpt"
              rows={2}
              value={v.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
            />
            <div className="mt-4 space-y-1.5">
              <Label>Body</Label>
              <MarkdownEditor
                value={v.body ?? ""}
                onChange={(body) => set({ body })}
                placeholder="Write the article in Markdown…"
              />
            </div>
          </div>
        </div>

        {/* Meta sidebar */}
        <div className="w-full flex-none space-y-4 lg:w-80">
          <Panel title="Publish">
            <SelectField
              label="Status"
              options={ARTICLE_STATUSES.map((s) => ({ value: s, label: s }))}
              value={v.status}
              onValueChange={(s) => set({ status: s })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="publish-at">Publish date</Label>
              <Input
                id="publish-at"
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
              />
            </div>
          </Panel>

          <Panel title="Organize">
            <div className="space-y-1.5">
              <Label>Categories</Label>
              <TagInput
                value={v.categories}
                onChange={(categories) => set({ categories })}
                placeholder="Treatment guide…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <TagInput
                value={v.tags}
                onChange={(tags) => set({ tags })}
                placeholder="knee, MSC…"
              />
            </div>
          </Panel>

          <Panel title="Related">
            <div className="space-y-1.5">
              <Label>Conditions</Label>
              <MultiSelect
                value={v.relatedConditionIds}
                onChange={(relatedConditionIds) => set({ relatedConditionIds })}
                options={options.conditions}
                addLabel="Add condition"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Treatments</Label>
              <MultiSelect
                value={v.relatedTreatmentIds}
                onChange={(relatedTreatmentIds) => set({ relatedTreatmentIds })}
                options={options.treatments}
                addLabel="Add treatment"
              />
            </div>
          </Panel>

          <Panel title="Author">
            <TextField
              label="Name"
              value={v.author.name}
              onChange={(e) => set({ author: { ...v.author, name: e.target.value } })}
            />
            <TextareaField
              label="Bio"
              rows={2}
              value={v.author.bio}
              onChange={(e) => set({ author: { ...v.author, bio: e.target.value } })}
            />
            <ImagePicker
              label="Avatar"
              aspect="square"
              value={v.author.avatar}
              onChange={(avatar) => set({ author: { ...v.author, avatar } })}
              folder="authors"
            />
          </Panel>

          <Panel title="SEO">
            <TextField
              label="Meta title"
              value={v.seo.metaTitle}
              onChange={(e) => set({ seo: { ...v.seo, metaTitle: e.target.value } })}
            />
            <TextareaField
              label="Meta description"
              rows={2}
              value={v.seo.metaDescription}
              onChange={(e) =>
                set({ seo: { ...v.seo, metaDescription: e.target.value } })
              }
            />
          </Panel>
        </div>
      </div>
    </form>
  );
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

"use client";

import * as React from "react";

import { TemplatePicker } from "@/components/seoteam/template-picker";
import { PostEditor, type EditorValues } from "@/components/seoteam/post-editor";
import { getTemplate } from "@/lib/seoteam/templates";
import type { ReviewerOption } from "@/components/content/editorial-fields";
import type { BlogTemplateKey } from "@/lib/enums";

/** New-post flow: choose a template, then edit. */
export function NewPostFlow({ reviewers }: { reviewers: ReviewerOption[] }) {
  const [template, setTemplate] = React.useState<BlogTemplateKey | null>(null);

  if (!template) {
    return <TemplatePicker onSelect={setTemplate} />;
  }

  const tpl = getTemplate(template);
  const initial: EditorValues = {
    title: "",
    slug: "",
    template,
    excerpt: "",
    metaTitle: "",
    coverImage: undefined,
    keywords: [],
    linkFirstOnly: true,
    author: "",
    reviewedBy: "",
    lastReviewedAt: "",
    body: tpl.body,
    visibility: "draft",
    publishedAt: "",
  };

  return <PostEditor mode="create" initial={initial} reviewers={reviewers} />;
}

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * PageLead — the intro paragraph under a page's H1.
 *
 * Its own component because the string is editor-supplied (`PageContent.lead`)
 * and may carry inline HTML: several pages put a link in the intro, and losing
 * that when the copy moved into the CMS would have been a regression. The HTML
 * is sanitized on save by the same allow-list every authored body passes
 * through, so this is the render half of that contract, not a second trust
 * boundary.
 *
 * Renders nothing when the lead is blank, so a page that ships without one (the
 * privacy policy, the terms) gets no empty paragraph.
 */
export function PageLead({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  if (!html.trim()) return null;
  return (
    <p
      className={cn("text-[15px] leading-relaxed text-text-secondary", className)}
      // Sanitized on save (app/api/admin/page-content/[...path]/route.ts).
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

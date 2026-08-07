/**
 * Site-page editor `/admin/content/site-pages/{path}`. Editor+.
 *
 * The URL segment after the base is the route being edited, so `/about` is
 * edited at `/admin/content/site-pages/about`. A path the registry does not
 * declare 404s rather than offering a form whose saves nothing would read.
 */
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { SitePageForm } from "@/components/admin/content/site-page-form";
import { getPageContentEditorData } from "@/lib/admin/page-content";
import { normalizePagePath } from "@/config/static-pages";

export const dynamic = "force-dynamic";

export default async function AdminSitePageEditor({
  params,
}: {
  params: { path: string[] };
}) {
  await requireRole("editor", "/admin/content/site-pages");

  const path = normalizePagePath("/" + params.path.join("/"));
  const data = await getPageContentEditorData(path);
  if (!data) notFound();

  return (
    <SitePageForm
      entry={data.entry}
      defaults={data.defaults}
      stored={data.stored}
    />
  );
}

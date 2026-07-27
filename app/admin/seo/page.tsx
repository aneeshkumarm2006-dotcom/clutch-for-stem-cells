/**
 * Page SEO `/admin/seo` — meta title/description for the code-owned routes
 * (homepage, `/clinics`, the hubs, the legal pages). Editor+.
 */
import { requireRole } from "@/lib/auth";
import { PageSeoManager } from "@/components/admin/seo/page-seo-manager";
import { getPageSeoRows, PAGE_SEO_POINTERS } from "@/lib/admin/page-seo";

export const dynamic = "force-dynamic";

export default async function AdminPageSeoPage() {
  await requireRole("editor", "/admin/seo");
  const rows = await getPageSeoRows();
  return <PageSeoManager rows={rows} pointers={PAGE_SEO_POINTERS} />;
}

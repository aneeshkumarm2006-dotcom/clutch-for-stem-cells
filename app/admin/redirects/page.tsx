/**
 * Redirects `/admin/redirects` — Admin+ (a redirect is a site-wide routing
 * change). Part of the per-page SEO layer.
 */
import { requireRole } from "@/lib/auth";
import { RedirectsManager } from "@/components/admin/redirects/redirects-manager";
import { getRedirects } from "@/lib/admin/redirects";

export const dynamic = "force-dynamic";

export default async function AdminRedirectsPage() {
  // The layout gates to Editor+; redirects are Admin+, so re-check here.
  await requireRole("admin", "/admin/redirects");
  const redirects = await getRedirects();
  return <RedirectsManager redirects={redirects} />;
}

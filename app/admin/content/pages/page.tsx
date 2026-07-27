/**
 * Site content `/admin/content/pages` (PRD §8.7 / Stage 6.9) — the shared
 * partner logos and disclaimer copy. The homepage moved to
 * `/admin/content/homepage`.
 */
import { PagesForm } from "@/components/admin/content/pages-form";
import { getSettingsView } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const settings = await getSettingsView();
  return <PagesForm settings={settings} />;
}

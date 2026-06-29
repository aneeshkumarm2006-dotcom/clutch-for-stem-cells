/**
 * Pages & homepage config `/admin/content/pages` (PRD §8.7 / Stage 6.9).
 */
import { PagesForm } from "@/components/admin/content/pages-form";
import { getSettingsView } from "@/lib/admin/settings";
import { getClinicOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const [settings, clinicOptions] = await Promise.all([
    getSettingsView(),
    getClinicOptions(),
  ]);
  return <PagesForm settings={settings} clinicOptions={clinicOptions} />;
}

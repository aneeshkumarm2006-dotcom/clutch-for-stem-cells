/**
 * Settings `/admin/settings` (PRD §8.10 / Stage 6.12). Admin+.
 */
import { requireRole } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { getSettingsView } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole("admin", "/admin/settings");
  const settings = await getSettingsView();
  return <SettingsForm settings={settings} />;
}

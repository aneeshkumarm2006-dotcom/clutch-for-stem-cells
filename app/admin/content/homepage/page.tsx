/**
 * Homepage editor `/admin/content/homepage`. Editor+ — every section, string,
 * and meta field of the landing page.
 */
import { requireRole } from "@/lib/auth";
import { HomepageForm } from "@/components/admin/content/homepage-form";
import { getHomepageView } from "@/lib/admin/homepage";
import { getClinicOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  await requireRole("editor", "/admin/content/homepage");
  const [view, clinicOptions] = await Promise.all([
    getHomepageView(),
    getClinicOptions(),
  ]);
  return <HomepageForm view={view} clinicOptions={clinicOptions} />;
}

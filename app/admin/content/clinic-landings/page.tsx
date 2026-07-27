/**
 * Clinic landing pages `/admin/content/clinic-landings` — the curated
 * `/clinics/{slug}` directory pages. Editor+.
 */
import { requireRole } from "@/lib/auth";
import { ClinicLandingsManager } from "@/components/admin/content/clinic-landings-manager";
import { getAdminClinicLandings } from "@/lib/admin/clinic-landings";
import { getTaxonomyOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function AdminClinicLandingsPage() {
  await requireRole("editor", "/admin/content/clinic-landings");
  const [rows, taxonomy] = await Promise.all([
    getAdminClinicLandings(),
    getTaxonomyOptions(),
  ]);

  return (
    <ClinicLandingsManager
      rows={rows}
      treatmentOptions={taxonomy.treatments}
      conditionOptions={taxonomy.conditions}
    />
  );
}

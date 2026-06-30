/**
 * Edit clinic `/admin/clinics/[id]` (PRD §8.2 / Stage 6.4).
 */
import { notFound } from "next/navigation";

import {
  ClinicForm,
  type ClinicFormOptions,
  type ClinicFormValues,
} from "@/components/admin/clinics/clinic-form";
import { ClinicAnalyticsPanel } from "@/components/admin/clinics/clinic-analytics-panel";
import { getAdminClinicFormData } from "@/lib/admin/clinics";
import { getTaxonomyOptions, getUserOptions } from "@/lib/admin/lookups";
import { getClinicAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function EditClinicPage({
  params,
}: {
  params: { id: string };
}) {
  const [data, taxonomy, providers, analytics] = await Promise.all([
    getAdminClinicFormData(params.id),
    getTaxonomyOptions(),
    getUserOptions("provider"),
    getClinicAnalytics(params.id, 30),
  ]);

  if (!data) notFound();

  const options: ClinicFormOptions = {
    treatments: taxonomy.treatments,
    conditions: taxonomy.conditions,
    cellSources: taxonomy.cellSources,
    accreditations: taxonomy.accreditations,
    providers: providers.map((p) => ({ value: p.value, label: p.label })),
  };

  return (
    <div className="space-y-5">
      <ClinicAnalyticsPanel analytics={analytics} className="mx-5 mt-5 lg:mx-7" />
      <ClinicForm
        mode="edit"
        clinicId={data.id}
        slug={data.values.slug as string}
        defaultValues={data.values as unknown as ClinicFormValues}
        options={options}
      />
    </div>
  );
}

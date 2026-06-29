/**
 * Edit clinic `/admin/clinics/[id]` (PRD §8.2 / Stage 6.4).
 */
import { notFound } from "next/navigation";

import {
  ClinicForm,
  type ClinicFormOptions,
  type ClinicFormValues,
} from "@/components/admin/clinics/clinic-form";
import { getAdminClinicFormData } from "@/lib/admin/clinics";
import { getTaxonomyOptions, getUserOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function EditClinicPage({
  params,
}: {
  params: { id: string };
}) {
  const [data, taxonomy, providers] = await Promise.all([
    getAdminClinicFormData(params.id),
    getTaxonomyOptions(),
    getUserOptions("provider"),
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
    <ClinicForm
      mode="edit"
      clinicId={data.id}
      slug={data.values.slug as string}
      defaultValues={data.values as unknown as ClinicFormValues}
      options={options}
    />
  );
}

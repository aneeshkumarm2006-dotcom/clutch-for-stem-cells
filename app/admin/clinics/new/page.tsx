/**
 * New clinic `/admin/clinics/new` (PRD §8.2 / Stage 6.4).
 */
import {
  ClinicForm,
  emptyClinic,
  type ClinicFormOptions,
} from "@/components/admin/clinics/clinic-form";
import { getTaxonomyOptions, getUserOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function NewClinicPage() {
  const [taxonomy, providers] = await Promise.all([
    getTaxonomyOptions(),
    getUserOptions("provider"),
  ]);

  const options: ClinicFormOptions = {
    treatments: taxonomy.treatments,
    conditions: taxonomy.conditions,
    cellSources: taxonomy.cellSources,
    accreditations: taxonomy.accreditations,
    providers: providers.map((p) => ({ value: p.value, label: p.label })),
  };

  return (
    <ClinicForm mode="create" defaultValues={emptyClinic()} options={options} />
  );
}

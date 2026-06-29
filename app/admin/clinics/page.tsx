/**
 * Clinics list `/admin/clinics` (PRD §8.2 / Stage 6.3).
 *
 * Searchable/filterable/sortable DataTable with bulk actions + CSV export.
 */
import Link from "next/link";
import { Download, Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { ClinicsFilters } from "@/components/admin/clinics/clinics-filters";
import { ClinicsTable } from "@/components/admin/clinics/clinics-table";
import {
  getAdminClinics,
  getClinicCountries,
  type ClinicsQuery,
} from "@/lib/admin/clinics";
import { getTaxonomyOptions } from "@/lib/admin/lookups";
import { firstParam, parsePage } from "@/lib/admin/serialize";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminClinicsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const query: ClinicsQuery = {
    q: firstParam(searchParams.q),
    status: firstParam(searchParams.status),
    tier: firstParam(searchParams.tier),
    country: firstParam(searchParams.country),
    treatment: firstParam(searchParams.treatment),
    verified: firstParam(searchParams.verified) === "1" || undefined,
    sort: firstParam(searchParams.sort),
    page: parsePage(firstParam(searchParams.page)),
  };

  const [data, countries, taxonomy] = await Promise.all([
    getAdminClinics(query),
    getClinicCountries(),
    getTaxonomyOptions(),
  ]);

  // Carry filters into the export link.
  const exportParams = new URLSearchParams();
  for (const key of ["q", "status", "tier", "country", "treatment"] as const) {
    const v = firstParam(searchParams[key]);
    if (v) exportParams.set(key, v);
  }
  if (query.verified) exportParams.set("verified", "1");
  const exportHref = `/api/admin/clinics/export?${exportParams.toString()}`;

  return (
    <>
      <PageHeader title="Clinics">
        <Button asChild variant="secondary" size="sm">
          <a href={exportHref} download>
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
        <Button asChild size="sm">
          <Link href="/admin/clinics/new">
            <Plus className="size-4" />
            Add clinic
          </Link>
        </Button>
      </PageHeader>

      <div className="p-5 lg:p-7">
        <ClinicsFilters
          countries={countries}
          treatments={taxonomy.treatments.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
          total={data.total}
        />
        <ClinicsTable
          rows={data.rows}
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
        />
      </div>
    </>
  );
}

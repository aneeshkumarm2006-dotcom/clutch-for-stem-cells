"use client";

import { FilterSelect } from "@/components/admin/filter-select";
import { useQueryParams } from "@/components/admin/use-query-params";

/** Entity-type filter for the audit log (writes `?entityType=`). */
export function AuditEntityFilter({ entityTypes }: { entityTypes: string[] }) {
  const { searchParams, setParams } = useQueryParams();
  return (
    <FilterSelect
      value={searchParams.get("entityType") ?? undefined}
      onChange={(v) => setParams({ entityType: v ?? null }, { resetPage: true })}
      options={entityTypes.map((t) => ({ value: t, label: t }))}
      allLabel="All types"
    />
  );
}

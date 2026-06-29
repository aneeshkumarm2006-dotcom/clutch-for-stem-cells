"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/admin/filter-select";
import { Toggle } from "@/components/admin/toggle";
import { useQueryParams } from "@/components/admin/use-query-params";
import { CLINIC_STATUSES, CLINIC_TIERS } from "@/lib/enums";

const STATUS_OPTS = CLINIC_STATUSES.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));
const TIER_OPTS = CLINIC_TIERS.map((t) => ({
  value: t,
  label: t.charAt(0).toUpperCase() + t.slice(1),
}));

export function ClinicsFilters({
  countries,
  treatments,
  total,
}: {
  countries: string[];
  treatments: { value: string; label: string }[];
  total: number;
}) {
  const { searchParams, setParams } = useQueryParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  // Debounce the free-text search.
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => setParams({ q: q || null }, { resetPage: true }), 350);
    return () => clearTimeout(t);
  }, [q, searchParams, setParams]);

  const verified = searchParams.get("verified") === "1";

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clinics"
          className="h-9 pl-9"
        />
      </div>
      <FilterSelect
        value={searchParams.get("status") ?? undefined}
        onChange={(v) => setParams({ status: v ?? null }, { resetPage: true })}
        options={STATUS_OPTS}
        allLabel="All statuses"
      />
      <FilterSelect
        value={searchParams.get("tier") ?? undefined}
        onChange={(v) => setParams({ tier: v ?? null }, { resetPage: true })}
        options={TIER_OPTS}
        allLabel="All tiers"
      />
      <FilterSelect
        value={searchParams.get("country") ?? undefined}
        onChange={(v) => setParams({ country: v ?? null }, { resetPage: true })}
        options={countries.map((c) => ({ value: c, label: c }))}
        allLabel="All countries"
      />
      {treatments.length > 0 ? (
        <FilterSelect
          value={searchParams.get("treatment") ?? undefined}
          onChange={(v) => setParams({ treatment: v ?? null }, { resetPage: true })}
          options={treatments}
          allLabel="All treatments"
        />
      ) : null}
      <label className="flex items-center gap-2 text-[13px] text-text-secondary">
        <Toggle
          checked={verified}
          onCheckedChange={(c) =>
            setParams({ verified: c ? "1" : null }, { resetPage: true })
          }
          label="Verified only"
        />
        Verified
      </label>
      <span className="ml-auto text-[13px] text-text-muted">
        {total} {total === 1 ? "clinic" : "clinics"}
      </span>
    </div>
  );
}

"use client";

/**
 * ShortlistView — the member's saved clinics (Stage 5.11 / PRD §6.10). The source
 * of truth is the client shortlist set (guest localStorage → synced on login),
 * so this fetches the matching clinic cards by slug and re-renders as the set
 * changes (e.g. when a card's Save button is toggled).
 */
import * as React from "react";
import Link from "next/link";
import { HeartOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClinicListSkeleton } from "@/components/ui/skeleton";
import { ClinicCardGrid } from "@/components/clinic/savable-clinic-card";
import { useShortlist } from "@/lib/hooks/use-shortlist";
import type { ClinicCardData } from "@/components/clinic/clinic-card";

export function ShortlistView() {
  const { slugs, ready } = useShortlist();
  const key = React.useMemo(() => [...slugs].sort().join(","), [slugs]);
  const [clinics, setClinics] = React.useState<ClinicCardData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!ready) return;
    if (!key) {
      setClinics([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/clinics/by-slugs?slugs=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data: { clinics: ClinicCardData[] }) => {
        if (active) setClinics(data.clinics ?? []);
      })
      .catch(() => active && setClinics([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [key, ready]);

  if (!ready || loading) {
    return <ClinicListSkeleton count={2} />;
  }

  if (!clinics.length) {
    return (
      <EmptyState
        icon={HeartOff}
        title="Your shortlist is empty"
        description="Save clinics as you browse and they'll appear here — even before you sign in."
        action={
          <Button asChild>
            <Link href="/clinics">Browse clinics</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="mb-5 text-sm text-text-secondary">
        {clinics.length} saved {clinics.length === 1 ? "clinic" : "clinics"}
      </p>
      <ClinicCardGrid clinics={clinics} columns={2} />
    </>
  );
}

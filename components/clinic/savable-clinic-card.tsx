"use client";

import { ClinicCard, type ClinicCardData } from "@/components/clinic/clinic-card";
import { SaveButton } from "@/components/shortlist/save-button";

/**
 * SavableClinicCard — a {@link ClinicCard} with a floating shortlist Save button
 * (PRD §6.2 card actions). Used in every results grid so visitors can save while
 * browsing (guest localStorage → synced on login).
 */
export function SavableClinicCard({
  clinic,
  className,
}: {
  clinic: ClinicCardData;
  className?: string;
}) {
  return (
    <ClinicCard
      clinic={clinic}
      className={className}
      actionSlot={
        <SaveButton slug={clinic.slug} name={clinic.name} variant="icon" />
      }
    />
  );
}

/** A responsive grid of savable clinic cards. */
export function ClinicCardGrid({
  clinics,
  columns = 2,
}: {
  clinics: ClinicCardData[];
  columns?: 1 | 2 | 3;
}) {
  const cols =
    columns === 3
      ? "md:grid-cols-2 xl:grid-cols-3"
      : columns === 2
        ? "md:grid-cols-2"
        : "";
  return (
    <div className={`grid gap-5 ${cols}`}>
      {clinics.map((c) => (
        <SavableClinicCard key={c.slug} clinic={c} />
      ))}
    </div>
  );
}

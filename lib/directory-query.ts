/**
 * Directory query resolution (Stage 5.2). Turns Next.js `searchParams` into typed
 * {@link ClinicSearchParams}, applies the "Top clinics" tab (view=top → verified
 * leaders), and merges any route-pinned filters (treatment/condition/location).
 */
import {
  parseClinicSearchParams,
  type ClinicSearchParams,
} from "@/lib/search";

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function directoryParamsFrom(
  searchParams: RawParams,
  overrides: Partial<ClinicSearchParams> = {},
): ClinicSearchParams {
  const base = parseClinicSearchParams(searchParams);
  if (single(searchParams.view) === "top") {
    base.verifiedOnly = true;
    base.sort = base.sort ?? "recommended";
  }
  return { ...base, ...overrides };
}

export function isTopView(searchParams: RawParams): boolean {
  return single(searchParams.view) === "top";
}

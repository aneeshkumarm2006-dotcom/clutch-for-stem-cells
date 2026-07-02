import type { Metadata } from "next";

import {
  buildCombinationMetadata,
  CombinationPage,
} from "@/components/combination/combination-page";
import { getApprovedMatrixParams } from "@/lib/seoteam/matrix-data";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const combos = await getApprovedMatrixParams("treatment_country");
    // slugA = treatment, slugB = country
    return combos.map((c) => ({ country: c.slugB, treatment: c.slugA }));
  } catch {
    return [];
  }
}

export function generateMetadata({
  params,
}: {
  params: { country: string; treatment: string };
}): Promise<Metadata> {
  return buildCombinationMetadata(
    "treatment_country",
    params.treatment,
    params.country,
  );
}

export default function TreatmentInCountryPage({
  params,
  searchParams,
}: {
  params: { country: string; treatment: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <CombinationPage
      kind="treatment_country"
      slugA={params.treatment}
      slugB={params.country}
      searchParams={searchParams}
    />
  );
}

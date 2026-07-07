import type { Metadata } from "next";

import {
  buildCombinationMetadata,
  CombinationPage,
} from "@/components/combination/combination-page";
import { getApprovedMatrixParams } from "@/lib/seoteam/matrix-data";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const combos = await getApprovedMatrixParams("treatment_condition");
    return combos.map((c) => ({ slug: c.slugA, condition: c.slugB }));
  } catch {
    return [];
  }
}

export function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string; condition: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  return buildCombinationMetadata(
    "treatment_condition",
    params.slug,
    params.condition,
    searchParams,
  );
}

export default function TreatmentForConditionPage({
  params,
  searchParams,
}: {
  params: { slug: string; condition: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <CombinationPage
      kind="treatment_condition"
      slugA={params.slug}
      slugB={params.condition}
      searchParams={searchParams}
    />
  );
}

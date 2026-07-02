import type { Metadata } from "next";

import {
  buildCombinationMetadata,
  CombinationPage,
} from "@/components/combination/combination-page";
import { getApprovedMatrixParams } from "@/lib/seoteam/matrix-data";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const combos = await getApprovedMatrixParams("condition_country");
    // slugA = condition, slugB = country
    return combos.map((c) => ({ country: c.slugB, condition: c.slugA }));
  } catch {
    return [];
  }
}

export function generateMetadata({
  params,
}: {
  params: { country: string; condition: string };
}): Promise<Metadata> {
  return buildCombinationMetadata(
    "condition_country",
    params.condition,
    params.country,
  );
}

export default function ConditionInCountryPage({
  params,
  searchParams,
}: {
  params: { country: string; condition: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <CombinationPage
      kind="condition_country"
      slugA={params.condition}
      slugB={params.country}
      searchParams={searchParams}
    />
  );
}

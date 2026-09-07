import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { TreatmentComparison } from "@/components/tools/calculators/treatment-comparison";
import { pageMetadata } from "@/lib/page-metadata";
import { getClinicMatchIndex } from "@/lib/tools/match-data";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("treatment-comparison")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default async function TreatmentComparisonPage() {
  // No price data here, unlike the other cost tools. The directory's clinic
  // price fields are a whole-clinic range and cannot answer "what does this
  // procedure cost"; see the header of `lib/tools/comparison.ts`.
  //
  // The match index is for the shortlist under the table, which is matched on
  // the selected focus's condition. The focus switches client-side, so the
  // whole index has to be in the page for the list to follow it.
  const index = await getClinicMatchIndex();

  return (
    <ToolPage tool={TOOL}>
      <TreatmentComparison index={index} />
    </ToolPage>
  );
}

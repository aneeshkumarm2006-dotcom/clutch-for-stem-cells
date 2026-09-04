import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { TreatmentComparison } from "@/components/tools/calculators/treatment-comparison";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("treatment-comparison")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function TreatmentComparisonPage() {
  // No price data here, unlike the other cost tools. The directory's clinic
  // price fields are a whole-clinic range and cannot answer "what does this
  // procedure cost"; see the header of `lib/tools/comparison.ts`.
  return (
    <ToolPage tool={TOOL}>
      <TreatmentComparison />
    </ToolPage>
  );
}

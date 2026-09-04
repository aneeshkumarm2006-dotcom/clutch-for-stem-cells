import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { TreatmentCostCalculator } from "@/components/tools/calculators/treatment-cost";
import { pageMetadata } from "@/lib/page-metadata";
import { getToolPriceData } from "@/lib/tools/price-data";
import { getClinicMatchIndex } from "@/lib/tools/match-data";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("stem-cell-cost-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default async function StemCellCostCalculatorPage() {
  // Aggregated on the server so the price bands are in the delivered HTML, not
  // fetched afterwards. That matters for a page whose whole claim is that its
  // numbers came from published clinic prices: a crawler should be able to read
  // them without running the widget. The clinic index rides along for the same
  // reason, so the listings under the estimate are in the HTML too.
  const [data, index] = await Promise.all([
    getToolPriceData(),
    getClinicMatchIndex(),
  ]);

  return (
    <ToolPage tool={TOOL}>
      <TreatmentCostCalculator data={data} index={index} />
    </ToolPage>
  );
}

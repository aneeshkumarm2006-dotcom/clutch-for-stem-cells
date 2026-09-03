import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { TravelCostCalculator } from "@/components/tools/calculators/travel-cost";
import { pageMetadata } from "@/lib/page-metadata";
import { getToolPriceData } from "@/lib/tools/price-data";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("medical-travel-cost-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default async function MedicalTravelCostPage() {
  // The treatment line is prefilled from the directory median so the first
  // number a visitor sees is anchored to something real. They can overwrite it
  // with their own quote, which is the intended use.
  const data = await getToolPriceData();

  return (
    <ToolPage tool={TOOL}>
      <TravelCostCalculator
        currency={data.currency}
        defaultTreatmentCost={data.overall.typical}
      />
    </ToolPage>
  );
}

import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { SurgeryCompareCalculator } from "@/components/tools/calculators/surgery-compare";
import { pageMetadata } from "@/lib/page-metadata";
import { getToolPriceData } from "@/lib/tools/price-data";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("stem-cell-vs-surgery-cost")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default async function StemCellVsSurgeryPage() {
  const data = await getToolPriceData();

  return (
    <ToolPage tool={TOOL}>
      <SurgeryCompareCalculator data={data} />
    </ToolPage>
  );
}

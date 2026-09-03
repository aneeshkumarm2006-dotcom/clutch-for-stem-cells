import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { IdealWeightCalculator } from "@/components/tools/calculators/ideal-weight";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("ideal-weight-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function IdealWeightCalculatorPage() {
  return (
    <ToolPage tool={TOOL}>
      <IdealWeightCalculator />
    </ToolPage>
  );
}

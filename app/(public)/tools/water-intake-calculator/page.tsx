import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { WaterIntakeCalculator } from "@/components/tools/calculators/water-intake";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("water-intake-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function WaterIntakeCalculatorPage() {
  return (
    <ToolPage tool={TOOL}>
      <WaterIntakeCalculator />
    </ToolPage>
  );
}

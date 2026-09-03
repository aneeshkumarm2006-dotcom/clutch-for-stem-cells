import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { BmrCalculator } from "@/components/tools/calculators/bmr";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("bmr-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function BmrCalculatorPage() {
  return (
    <ToolPage tool={TOOL}>
      <BmrCalculator />
    </ToolPage>
  );
}

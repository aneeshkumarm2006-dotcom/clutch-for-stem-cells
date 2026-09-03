import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { BodyFatCalculator } from "@/components/tools/calculators/body-fat";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("body-fat-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function BodyFatCalculatorPage() {
  return (
    <ToolPage tool={TOOL}>
      <BodyFatCalculator />
    </ToolPage>
  );
}

import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { BackScoreCalculator } from "@/components/tools/calculators/back-score";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("back-pain-disability-score")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function BackPainScorePage() {
  return (
    <ToolPage tool={TOOL}>
      <BackScoreCalculator />
    </ToolPage>
  );
}

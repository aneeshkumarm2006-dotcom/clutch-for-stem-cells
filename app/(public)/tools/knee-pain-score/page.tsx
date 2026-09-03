import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { KneeScoreCalculator } from "@/components/tools/calculators/knee-score";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("knee-pain-score")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function KneePainScorePage() {
  return (
    <ToolPage tool={TOOL}>
      <KneeScoreCalculator />
    </ToolPage>
  );
}

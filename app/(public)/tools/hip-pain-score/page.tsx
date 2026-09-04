import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { JointScoreCalculator } from "@/components/tools/calculators/joint-score";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("hip-pain-score")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function HipPainScorePage() {
  return (
    <ToolPage tool={TOOL}>
      <JointScoreCalculator joint="hip" />
    </ToolPage>
  );
}

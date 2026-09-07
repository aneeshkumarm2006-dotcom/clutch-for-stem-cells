import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { JointScoreCalculator } from "@/components/tools/calculators/joint-score";
import { pageMetadata } from "@/lib/page-metadata";
import { getClinicMatchIndex } from "@/lib/tools/match-data";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("knee-pain-score")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default async function KneePainScorePage() {
  // Only for the clinic shortlist under a completed score, which is matched on
  // the condition rather than on the score. See `joint-score.tsx`.
  const index = await getClinicMatchIndex();

  return (
    <ToolPage tool={TOOL}>
      <JointScoreCalculator joint="knee" index={index} />
    </ToolPage>
  );
}

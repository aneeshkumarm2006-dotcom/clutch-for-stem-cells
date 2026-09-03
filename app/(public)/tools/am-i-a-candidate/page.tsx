import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { CandidacyCalculator } from "@/components/tools/calculators/candidacy";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("am-i-a-candidate")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function CandidacyPage() {
  return (
    <ToolPage tool={TOOL}>
      <CandidacyCalculator />
    </ToolPage>
  );
}

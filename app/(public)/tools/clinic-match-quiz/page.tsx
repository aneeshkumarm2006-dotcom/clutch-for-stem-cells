import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { ClinicMatchQuiz } from "@/components/tools/calculators/clinic-match";
import { pageMetadata } from "@/lib/page-metadata";
import { getClinicMatchIndex } from "@/lib/tools/match-data";
import { toolBySlug, toolPath } from "@/config/tools";

const TOOL = toolBySlug("clinic-match-quiz")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default async function ClinicMatchQuizPage() {
  // The whole index is prerendered into the page so the quiz re-ranks on every
  // answer without a round trip, and so the clinics it can suggest are in the
  // delivered HTML rather than behind a script. See `lib/tools/match-data.ts`
  // for what that costs and the cap that bounds it.
  const index = await getClinicMatchIndex();

  return (
    <ToolPage tool={TOOL}>
      <ClinicMatchQuiz index={index} />
    </ToolPage>
  );
}

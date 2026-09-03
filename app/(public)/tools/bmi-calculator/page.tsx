import type { Metadata } from "next";

import { ToolPage } from "@/components/tools/tool-page";
import { BmiCalculator } from "@/components/tools/calculators/bmi";
import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug, toolPath } from "@/config/tools";

/**
 * Every calculator route follows this shape: pull the definition out of the
 * registry, hand it to `ToolPage` with the widget as a child, and let the shell
 * do the copy, the schema, the breadcrumbs and the cross-links. The `!` is a
 * deliberate build-time assertion, so a typo in a slug fails the build rather
 * than rendering a page with no title.
 */
const TOOL = toolBySlug("bmi-calculator")!;

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: toolPath(TOOL.slug) });

export default function BmiCalculatorPage() {
  return (
    <ToolPage tool={TOOL}>
      <BmiCalculator />
    </ToolPage>
  );
}

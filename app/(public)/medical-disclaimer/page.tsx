import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getPageContent } from "@/lib/page-content";
import { ProsePage } from "@/components/common/prose-page";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/medical-disclaimer" });

export default async function MedicalDisclaimerPage() {
  return <ProsePage content={await getPageContent("/medical-disclaimer")} />;
}

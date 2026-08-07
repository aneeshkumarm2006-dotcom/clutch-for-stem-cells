import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getPageContent } from "@/lib/page-content";
import { ProsePage } from "@/components/common/prose-page";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/terms" });

export default async function TermsPage() {
  return <ProsePage content={await getPageContent("/terms")} />;
}

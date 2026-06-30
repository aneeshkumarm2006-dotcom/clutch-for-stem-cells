import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Terms of service",
    description: `The terms that govern your use of ${SITE_NAME}.`,
    path: "/terms",
  });

export default function TermsPage() {
  return (
    <ProsePage title="Terms of service" updated="June 2026" legalReview>
      <h2>Acceptance</h2>
      <p>
        By using {SITE_NAME}, you agree to these terms. If you don&apos;t agree,
        please don&apos;t use the service.
      </p>
      <h2>Informational service</h2>
      <p>
        {SITE_NAME} is an informational directory and not a medical provider. See
        our <Link href="/medical-disclaimer">medical disclaimer</Link>. We do not
        guarantee the accuracy of clinic-supplied information, and we do not
        endorse any treatment.
      </p>
      <h2>Your content</h2>
      <p>
        You must be 18 or older to submit a review or inquiry. You are responsible
        for the accuracy of what you submit, and you grant us a licence to publish
        moderated reviews. We may edit or remove content that violates these terms
        or our <Link href="/editorial-policy">editorial policy</Link>.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>No false, misleading, or spam submissions</li>
        <li>No content that infringes others&apos; rights or privacy</li>
        <li>No attempts to disrupt or abuse the service</li>
      </ul>
      <h2>Limitation of liability</h2>
      <p>
        {SITE_NAME} is provided &ldquo;as is.&rdquo; To the fullest extent
        permitted by law, we are not liable for decisions made based on
        information found here. Always consult a licensed physician.
      </p>
    </ProsePage>
  );
}

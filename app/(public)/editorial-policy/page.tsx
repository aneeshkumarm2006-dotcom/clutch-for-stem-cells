import Link from "next/link";
import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Editorial policy",
  description: `How ${SITE_NAME} curates clinics, moderates reviews, and labels paid placement.`,
  path: "/editorial-policy",
});

export default function EditorialPolicyPage() {
  return (
    <ProsePage
      title="Editorial policy"
      updated="June 2026"
      lead="Our standards for curating clinics, moderating reviews, and keeping content trustworthy."
      legalReview
    >
      <h2>Independence</h2>
      <p>
        Editorial decisions are independent of advertising. Paid placement is
        always labelled &ldquo;Featured&rdquo; and never changes the content of
        patient reviews or our <Link href="/methodology">ranking methodology</Link>.
      </p>
      <h2>Review moderation</h2>
      <p>
        Reviews require email verification and are moderated before publishing. We
        remove spam, conflicts of interest, and content that can&apos;t be
        substantiated. We may lightly edit reviews to redact personal information
        or fix typos, without changing their meaning.
      </p>
      <h2>Health claims</h2>
      <p>
        We flag and do not publish language that promises a cure or guaranteed
        outcome. Treatment descriptions and case studies are labelled as
        provider- or patient-supplied, and we pair clinical content with the
        appropriate disclaimers.
      </p>
      <h2>Corrections</h2>
      <p>
        Spotted something inaccurate? Tell us via the{" "}
        <Link href="/contact">contact page</Link> and we&apos;ll review it
        promptly.
      </p>
    </ProsePage>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Methodology",
    description: `How ${SITE_NAME} ranks clinics, verifies accreditations, and labels paid placement.`,
    path: "/methodology",
  });

export default function MethodologyPage() {
  return (
    <ProsePage
      title="Ranking & verification methodology"
      lead="Transparency matters in a sensitive medical category. Here's exactly how clinics are ranked, what verification means, and how paid placement is labelled."
      updated="June 2026"
    >
      <h2>How clinics are ranked</h2>
      <p>
        The default &ldquo;Recommended&rdquo; order combines several signals into
        a single ranking score, then applies a clear priority:
      </p>
      <ul>
        <li>
          <strong>Featured clinics</strong> appear first and are clearly labelled
          &ldquo;Featured&rdquo; — this is paid placement.
        </li>
        <li>
          <strong>Verified clinics</strong> are prioritised next.
        </li>
        <li>
          Remaining clinics are ordered by their <strong>ranking score</strong>.
        </li>
      </ul>
      <p>The ranking score weighs:</p>
      <ul>
        <li>Average rating from approved, verified-eligible reviews</li>
        <li>Number of reviews (more reviews, more signal)</li>
        <li>Recency of recent reviews</li>
        <li>Profile completeness (media, team, pricing, case studies)</li>
        <li>Number and strength of verified accreditations</li>
        <li>Listing tier</li>
      </ul>
      <h2>What verification means</h2>
      <p>
        Verification is <strong>accreditation- and record-based</strong>. We
        check accreditations and registrations a clinic provides and confirm
        review authenticity where possible. Verification is{" "}
        <strong>not</strong> an endorsement of the safety or efficacy of any
        treatment, and it is not a clinical or regulatory approval.
      </p>
      <h2>How reviews are handled</h2>
      <p>
        Reviews require email verification and are moderated before they go live.
        We never publish a reviewer&apos;s email address, and reviewers may post
        anonymously as a &ldquo;Verified Patient.&rdquo; Reviews reflect
        individual experiences; results vary.
      </p>
      <h2>Paid placement</h2>
      <p>
        Clinics can pay for Verified or Featured tiers. Paid placement is always
        labelled, and it never changes the content of patient reviews. See plans
        on the <Link href="/for-clinics">for clinics</Link> page.
      </p>
    </ProsePage>
  );
}

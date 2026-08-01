import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/editorial-policy" });

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
        patient reviews or our{" "}
        <Link href="/methodology">ranking methodology</Link>.
      </p>
      <h2>Review moderation</h2>
      <p>
        Reviews require email verification and are moderated before publishing.
        We remove spam, conflicts of interest, and content that can&apos;t be
        substantiated. We may lightly edit reviews to redact personal
        information or fix typos, without changing their meaning.
      </p>
      <h2>Health claims</h2>
      <p>
        We flag and do not publish language that promises a cure or guaranteed
        outcome. Treatment descriptions and case studies are labelled as
        provider- or patient-supplied, and we pair clinical content with the
        appropriate disclaimers.
      </p>
      <h2>Who writes and reviews content</h2>
      <p>
        Our editorial team compiles clinic profiles from the clinic&apos;s own
        published material, public registries and accreditation records, then
        checks the result with the clinic. Treatment and condition explainers
        are written in-house. Where the subject is clinical, a medically
        qualified reviewer reads the page and their name and credentials appear
        on it. That byline means they read it. It is not an endorsement of any
        clinic listed there.
      </p>
      <h2>Sourcing</h2>
      <p>
        Claims about what a therapy is, how it is given and what is known about
        it trace back to regulators, peer-reviewed literature or the clinic, and
        we say which. Where the evidence is thin, we write that it is thin
        instead of reaching for a stronger verb. We will not publish a success
        rate without saying where the number came from, and we do not repeat a
        clinic&apos;s marketing copy as though it were a finding.
      </p>
      <h2>Keeping content current</h2>
      <p>
        Prices, accreditations and treatment lists change. We recheck clinic
        records on a rolling schedule and after any correction, and pages with a
        reviewer byline carry the date they were last read. A clinic that closes
        or loses an accreditation gets its profile updated or pulled, not
        quietly left standing.
      </p>
      <h2>Conflicts of interest</h2>
      <p>
        Advertising and editorial are kept apart. Nobody who sells a listing has
        a say in how a clinic is described, scored or ordered, and paid
        placement is labelled everywhere it shows up. Our{" "}
        <Link href="/methodology">ranking methodology</Link> lists every input,
        so you can check the ordering instead of trusting it.
      </p>
      <h2>Use of automated tools</h2>
      <p>
        We use software to gather and structure data, flag prohibited health
        claims and catch errors. People write and check what gets published, and
        a human reviewer reads clinical pages before they go live. Nothing here
        ships straight from a generated draft.
      </p>
      <h2>Corrections</h2>
      <p>
        Spotted something inaccurate? Tell us via the{" "}
        <Link href="/contact">contact page</Link> and we&apos;ll review it
        promptly. We fix factual errors on the page itself. A clinic that
        disputes a published review can raise it the same way, though
        disagreeing with a review is not grounds for taking it down. Showing it
        is false is.
      </p>
    </ProsePage>
  );
}

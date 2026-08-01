import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/medical-disclaimer" });

export default function MedicalDisclaimerPage() {
  return (
    <ProsePage
      title="Medical disclaimer"
      updated="June 2026"
      lead={`${SITE_NAME} is an informational directory, not a medical provider.`}
      legalReview
    >
      <h2>Information only</h2>
      <p>
        The content on {SITE_NAME}, including clinic profiles, treatment
        descriptions, case studies, and patient reviews, is provided for general
        informational purposes only. It is <strong>not medical advice</strong>,
        diagnosis, or treatment, and it is not a substitute for the advice of a
        qualified healthcare professional.
      </p>
      <h2>No endorsement or guarantee</h2>
      <p>
        Listing or verification of a clinic does not constitute an endorsement
        of the safety or efficacy of any treatment. Regenerative and stem cell
        therapies may be experimental or unproven, and regulations vary by
        country.{" "}
        <strong>Individual results vary and no outcome is guaranteed.</strong>
      </p>
      <h2>Provider- and patient-supplied content</h2>
      <p>
        Treatment descriptions and case studies are supplied by clinics or
        patients and are labelled as such. Reviews reflect individual
        experiences and are not typical or guaranteed.
      </p>
      <h2>Regulatory status varies by country</h2>
      <p>
        Many therapies described on this site are not approved by the FDA, the
        EMA or an equivalent regulator for the conditions patients ask about.
        What a clinic may legally offer changes from country to country, so a
        treatment that is routine in one place can be unavailable or unlawful in
        another. A clinic operating within its own country&apos;s rules has
        satisfied that regulator. Nothing more follows from it. That is not
        evidence a treatment is effective, and this site does not assess
        effectiveness.
      </p>
      <h2>Prices are indicative</h2>
      <p>
        The price ranges here come from the clinics and change without notice.
        Use them to compare, not as a quote. What you are actually charged
        depends on your diagnosis, the protocol, how many sessions are involved
        and what the clinic folds into its figure. Get the total, and what it
        covers, in writing from the clinic before you commit.
      </p>
      <h2>Reviews are individual experiences</h2>
      <p>
        A review describes what happened to one person. It is not a clinical
        outcome measure, it does not predict your result, and where there are
        only a handful of them a single review moves the average a long way.
        Read them for texture on communication, facilities and aftercare. Do not
        read them as proof a treatment works.
      </p>
      <h2>Travelling for treatment</h2>
      <p>
        Considering treatment abroad? Settle three things before you fly: who is
        responsible if a complication develops after you get back, what
        follow-up is included, and whether your own insurer or doctor will pick
        up the aftermath. Those answers are often what separates a manageable
        problem from an expensive one.
      </p>
      <h2>Always consult a physician</h2>
      <p>
        Never disregard professional medical advice or delay seeking it because
        of something you read on {SITE_NAME}. Always consult a licensed
        physician before making any treatment decision. In a medical emergency,
        contact your local emergency services.
      </p>
    </ProsePage>
  );
}

import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Medical disclaimer",
  description: `${SITE_NAME} provides information only and is not medical advice.`,
  path: "/medical-disclaimer",
});

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
        The content on {SITE_NAME} — including clinic profiles, treatment
        descriptions, case studies, and patient reviews — is provided for general
        informational purposes only. It is <strong>not medical advice</strong>,
        diagnosis, or treatment, and it is not a substitute for the advice of a
        qualified healthcare professional.
      </p>
      <h2>No endorsement or guarantee</h2>
      <p>
        Listing or verification of a clinic does not constitute an endorsement of
        the safety or efficacy of any treatment. Regenerative and stem cell
        therapies may be experimental or unproven, and regulations vary by
        country. <strong>Individual results vary and no outcome is guaranteed.</strong>
      </p>
      <h2>Provider- and patient-supplied content</h2>
      <p>
        Treatment descriptions and case studies are supplied by clinics or
        patients and are labelled as such. Reviews reflect individual experiences
        and are not typical or guaranteed.
      </p>
      <h2>Always consult a physician</h2>
      <p>
        Never disregard professional medical advice or delay seeking it because
        of something you read on {SITE_NAME}. Always consult a licensed physician
        before making any treatment decision. In a medical emergency, contact
        your local emergency services.
      </p>
    </ProsePage>
  );
}

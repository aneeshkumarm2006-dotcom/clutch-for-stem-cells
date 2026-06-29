import Link from "next/link";
import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description: `${SITE_NAME} is an independent directory helping patients research and compare regenerative-medicine clinics.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <ProsePage
      title={`About ${SITE_NAME}`}
      lead={`${SITE_NAME} is an independent directory that helps patients research, compare, and connect with regenerative-medicine clinics worldwide.`}
    >
      <h2>Why we exist</h2>
      <p>
        Researching stem cell and regenerative treatments is hard. Information is
        scattered, claims are often unsubstantiated, and pricing is opaque. We
        bring clinics into one place with consistent profiles, accreditation
        details, transparent pricing ranges, and verified patient reviews — so
        you can make a more informed decision.
      </p>
      <h2>What we are — and aren&apos;t</h2>
      <p>
        We are an informational directory. We are <strong>not</strong> a medical
        provider, and we do not deliver care, give medical advice, or endorse the
        safety or efficacy of any treatment. Always consult a licensed physician.
        Individual results vary and no outcome is guaranteed.
      </p>
      <h2>How clinics are listed</h2>
      <p>
        Clinics are curated by our team. Verification is based on accreditation
        and record checks, and paid placement is always labelled. You can read
        exactly how we rank and verify on our{" "}
        <Link href="/methodology">methodology page</Link>.
      </p>
      <h2>Get in touch</h2>
      <p>
        Questions, corrections, or a clinic to add? Visit our{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}

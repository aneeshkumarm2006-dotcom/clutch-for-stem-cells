import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";

import { buildMetadata, faqPageJsonLd, renderJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "FAQ",
  description: `Common questions about ${SITE_NAME}, verification, reviews, and how to use the directory.`,
  path: "/faq",
});

const FAQS: { question: string; answer: string }[] = [
  {
    question: `Is ${SITE_NAME} a clinic or medical provider?`,
    answer: `No. ${SITE_NAME} is an independent directory. We provide information to help you research clinics and do not deliver care or give medical advice. Always consult a licensed physician.`,
  },
  {
    question: "How are clinics verified?",
    answer:
      "Verification is based on accreditation and record checks. It confirms credentials a clinic provides — it is not an endorsement of any treatment's safety or efficacy. See our methodology page for details.",
  },
  {
    question: "Are the reviews real?",
    answer:
      "Reviews require email verification and are moderated before publishing. We never show a reviewer's email, and reviewers may post anonymously as a Verified Patient.",
  },
  {
    question: "Is the pricing accurate?",
    answer:
      "Pricing ranges are indicative and set by each clinic. Always confirm the final cost directly with the clinic before treatment.",
  },
  {
    question: "Does it cost anything to contact a clinic?",
    answer:
      "No. Requesting a consultation or getting matched is free for patients. We never sell your data; your details are shared only with the clinics you contact.",
  },
  {
    question: "How do I add or correct a clinic?",
    answer:
      "Clinics are curated by our team. If you represent a clinic or spot an error, reach out through our contact page.",
  },
];

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderJsonLd(faqPageJsonLd(FAQS)) }}
      />
      <div className="container max-w-3xl py-10 md:py-14">
        <header className="mb-8">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-[16px] text-text-secondary">
            Can&apos;t find what you&apos;re looking for?{" "}
            <Link href="/contact" className="font-medium text-text-link hover:underline">
              Contact our team
            </Link>
            .
          </p>
        </header>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group p-5 [&_summary]:list-none">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-[15.5px] font-semibold text-text-primary">
                {faq.question}
                <ChevronDown
                  className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}

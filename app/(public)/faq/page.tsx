import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";

import { faqPageJsonLd, renderJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/faq" });

const FAQS: { question: string; answer: string }[] = [
  {
    question: `Is ${SITE_NAME} a clinic or medical provider?`,
    answer: `No. ${SITE_NAME} is an independent directory. We provide information to help you research clinics and do not deliver care or give medical advice. Always consult a licensed physician.`,
  },
  {
    question: "How are clinics verified?",
    answer:
      "Verification is based on accreditation and record checks. It confirms credentials a clinic provides, and it is not an endorsement of any treatment's safety or efficacy. See our methodology page for details.",
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
  {
    question: "Does a listing mean the treatment works?",
    answer:
      "No. It means a clinic accepts patients for a condition and has a profile here. Most therapies described on this site have not been through the trials that would make them standard care for the conditions patients ask about, and some are legal in one country and not the next. We compare clinics. Whether a treatment is effective is not something we assess.",
  },
  {
    question: "Why do clinics abroad offer treatments my country does not?",
    answer:
      "Countries disagree on how much may be done to cells before they go back in. In the United States, culturing or expanding them crosses into drug territory, so domestic clinics mostly stick to minimally manipulated tissue. Several other countries allow expanded-cell protocols. The difference is regulatory rather than evidential, and it is the main reason people get on planes.",
  },
  {
    question: "What does the verified badge actually check?",
    answer:
      "The credentials and accreditations a clinic gives us, checked against the issuing bodies and public records, plus basic business and licensing details. It does not look at clinical outcomes and it is not an endorsement. The methodology page lists what is checked and what is not.",
  },
  {
    question: "How are clinics ordered in the directory?",
    answer:
      "The default order weighs verification status, how complete a profile is, published patient reviews, and how closely a clinic matches whatever filters you set. Paid placement is labelled Featured wherever it appears, and it changes nothing about a clinic's reviews, score or profile. You can re-sort any directory page yourself.",
  },
  {
    question: "Can a clinic remove a bad review?",
    answer:
      "No. Clinics get no approval, edit or veto over reviews. One that believes a review is false can raise it with us and we will look at the evidence, but disagreeing with a review is not grounds for pulling it. The reviews we do remove are the ones that break our content rules or that nobody can substantiate.",
  },
  {
    question: "What should I ask a clinic before booking?",
    answer:
      "Which cell source and preparation they would use for your condition. Who performs the procedure and what they are licensed to do. What the quoted total covers. What follow-up comes with it. Who is responsible if a complication develops once you are home. And what evidence supports that protocol for your diagnosis, rather than for the field in general.",
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
            <Link
              href="/contact"
              className="font-medium text-text-link hover:underline"
            >
              Contact our team
            </Link>
            .
          </p>
        </header>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group p-5 [&_summary]:list-none"
            >
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

        <section className="prose-article mt-12 border-t border-border pt-10">
          <h2>Still deciding where to start</h2>
          <p>
            Know your diagnosis? Start from{" "}
            <Link href="/conditions">the condition list</Link> and see who
            accepts patients for it. Know the procedure instead? Start from{" "}
            <Link href="/treatments">the treatment list</Link>. If cost or
            travel is what decides it, browse{" "}
            <Link href="/locations">by destination</Link>, or answer a few
            questions in the <Link href="/find-a-clinic">guided match</Link> and
            let it cut the directory down for you.
          </p>
          <p>
            Before you lean on any ordering here, read how we{" "}
            <Link href="/methodology">rank and verify clinics</Link> and how we{" "}
            <Link href="/editorial-policy">produce and moderate content</Link>.
            The <Link href="/medical-disclaimer">medical disclaimer</Link> is
            worth five minutes too. It spells out what this site is not: not
            medical advice, not an endorsement of anyone listed, and no promise
            that an outcome described here will be yours.
          </p>
        </section>
      </div>
    </>
  );
}

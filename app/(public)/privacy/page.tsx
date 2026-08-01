import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/privacy" });

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy" updated="June 2026" legalReview>
      <h2>What we collect</h2>
      <p>
        We collect the information you provide when you create an account,
        submit a review, request a consultation, or contact us, such as your
        name, email, and the details of your inquiry. We also collect limited
        usage analytics to improve the service.
      </p>
      <h2>How we use it</h2>
      <ul>
        <li>To operate the directory and your account</li>
        <li>To route consultation requests to the clinics you choose</li>
        <li>To verify and moderate reviews</li>
        <li>To improve our content and search</li>
      </ul>
      <h2>Reviews and health information</h2>
      <p>
        Your reviewer email is <strong>never shown publicly</strong>. You may
        post reviews anonymously. We ask you to share only the health details
        you are comfortable disclosing and we minimise what we store.
      </p>
      <h2>Sharing</h2>
      <p>
        We share your contact details only with the clinics you choose to
        contact. We do not sell your personal information.
      </p>
      <h2>Your rights</h2>
      <p>
        You can access, correct, or delete your account and data at any time
        from your <Link href="/account">account page</Link> or by contacting us.
      </p>
      <h2>Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and optional analytics
        cookies to understand usage. You can control cookies in your browser
        settings.
      </p>
      <h2>Why we are allowed to hold it</h2>
      <p>
        We process your information to run a service you asked for, such as your
        account or a consultation request going to a clinic; to meet a legal
        obligation; or because we have a legitimate interest in keeping the
        directory accurate and free of abuse. Where the law requires consent, as
        it does for optional analytics cookies, we ask for it, and you can
        withdraw it whenever you like.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Account data lasts as long as your account and goes when you close it. A
        published review stays up after an account closes unless you ask us to
        take it down, because pulling it would leave a hole in a record other
        readers use. We hold consultation requests for as long as we might need
        them to settle a dispute about what was sent and to whom. Aggregated
        analytics that cannot be traced back to you may be kept indefinitely.
      </p>
      <h2>Who else touches it</h2>
      <p>
        Third parties host the site, send our email, process uploads and measure
        traffic. They act on our instructions and cannot use your data for their
        own ends. We do not sell personal information, and none of it goes to
        advertisers.
      </p>
      <h2>Where it is processed</h2>
      <p>
        Our providers may process data in countries other than the one you live
        in. When that happens we rely on the safeguards the law provides for
        those transfers.
      </p>
      <h2>Children</h2>
      <p>
        This service is for adults. You must be 18 or older to create an
        account, submit a review or send an inquiry, and we do not knowingly
        collect information from children.
      </p>
      <h2>Changes and contact</h2>
      <p>
        If this policy changes in any material way we will update the date above
        and email account holders about it. For questions about your data, or to
        ask for a copy or a deletion, use the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}

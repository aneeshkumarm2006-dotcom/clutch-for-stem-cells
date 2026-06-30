import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Privacy policy",
    description: `How ${SITE_NAME} collects, uses, and protects your information.`,
    path: "/privacy",
  });

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy" updated="June 2026" legalReview>
      <h2>What we collect</h2>
      <p>
        We collect the information you provide when you create an account, submit
        a review, request a consultation, or contact us — such as your name,
        email, and the details of your inquiry. We also collect limited usage
        analytics to improve the service.
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
        post reviews anonymously. We ask you to share only the health details you
        are comfortable disclosing and we minimise what we store.
      </p>
      <h2>Sharing</h2>
      <p>
        We share your contact details only with the clinics you choose to contact.
        We do not sell your personal information.
      </p>
      <h2>Your rights</h2>
      <p>
        You can access, correct, or delete your account and data at any time from
        your <Link href="/account">account page</Link> or by contacting us.
      </p>
      <h2>Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and optional analytics
        cookies to understand usage. You can control cookies in your browser
        settings.
      </p>
    </ProsePage>
  );
}

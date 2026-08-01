import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { ProsePage } from "@/components/common/prose-page";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/terms" });

export default function TermsPage() {
  return (
    <ProsePage title="Terms of service" updated="June 2026" legalReview>
      <h2>Acceptance</h2>
      <p>
        By using {SITE_NAME}, you agree to these terms. If you don&apos;t agree,
        please don&apos;t use the service.
      </p>
      <h2>Informational service</h2>
      <p>
        {SITE_NAME} is an informational directory and not a medical provider.
        See our <Link href="/medical-disclaimer">medical disclaimer</Link>. We
        do not guarantee the accuracy of clinic-supplied information, and we do
        not endorse any treatment.
      </p>
      <h2>Your content</h2>
      <p>
        You must be 18 or older to submit a review or inquiry. You are
        responsible for the accuracy of what you submit, and you grant us a
        licence to publish moderated reviews. We may edit or remove content that
        violates these terms or our{" "}
        <Link href="/editorial-policy">editorial policy</Link>.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>No false, misleading, or spam submissions</li>
        <li>No content that infringes others&apos; rights or privacy</li>
        <li>No attempts to disrupt or abuse the service</li>
      </ul>
      <h2>Reviews and moderation</h2>
      <p>
        We moderate reviews before they appear and may decline or remove one
        that breaks these terms or our{" "}
        <Link href="/editorial-policy">editorial policy</Link>. Clinics get no
        approval, edit or veto over what is written about them. A clinic that
        believes a review is false can raise it with us and we will look, but
        simply disagreeing with a review is not a reason to take it down. If you
        submit one, keep it to your own experience and leave out anyone
        else&apos;s personal or health information.
      </p>
      <h2>Clinic listings</h2>
      <p>
        Profiles include material the clinic supplied. We check what we
        reasonably can, and we do not warrant that any of it is accurate,
        complete or current. A listing is not an endorsement. Neither is a
        verification badge or a paid featured position, and none of the three
        says anything about whether a treatment is safe or works. Whatever you
        arrange with a clinic is a contract between you and them. We are not a
        party to it and we do not act as anyone&apos;s agent.
      </p>
      <h2>Consultation requests</h2>
      <p>
        Request a consultation and we pass your details to the clinics you
        picked so they can reply. What they do with the inquiry, and how they
        handle your data, falls under their policies rather than ours. We cannot
        guarantee a clinic will respond, or how fast.
      </p>
      <h2>Intellectual property</h2>
      <p>
        The site, its content and its design belong to us or our licensors. Read
        and share pages for personal use as much as you like. Copying the
        directory, scraping it, or reusing the content commercially needs our
        written permission first.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        {SITE_NAME} is provided &ldquo;as is.&rdquo; To the fullest extent
        permitted by law, we are not liable for decisions made based on
        information found here, for the acts or omissions of any clinic, or for
        any outcome of a treatment you arrange. Nothing in these terms limits
        liability that cannot lawfully be limited. Always consult a licensed
        physician.
      </p>
      <h2>Changes and ending access</h2>
      <p>
        We may update these terms. Carrying on using the site after a change
        means you accept the revised version. We may suspend or close an account
        that breaks them. You can walk away whenever you want and delete your
        account from your <Link href="/account">account page</Link>.
      </p>
    </ProsePage>
  );
}

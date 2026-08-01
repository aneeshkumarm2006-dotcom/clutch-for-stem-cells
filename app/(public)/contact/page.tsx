import Link from "next/link";
import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { SiteSetting } from "@/models";
import { dbConnect } from "@/lib/db";
import { LeadForm } from "@/components/lead/lead-form";
import { SITE_NAME } from "@/config/site";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/contact" });

async function getContact() {
  await dbConnect();
  const settings = await SiteSetting.getGlobal();
  return settings.contact ?? {};
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const contact = await getContact();
  const topic = Array.isArray(searchParams.topic)
    ? searchParams.topic[0]
    : searchParams.topic;
  const plan = Array.isArray(searchParams.plan)
    ? searchParams.plan[0]
    : searchParams.plan;

  const isListing = topic === "listing";
  const defaultMessage = isListing
    ? `I'd like to list my clinic on ${SITE_NAME}${plan ? ` (interested in the ${plan} plan)` : ""}.`
    : undefined;

  return (
    <div className="container max-w-4xl py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
          {isListing ? "Get your clinic listed" : "Contact us"}
        </h1>
        <p className="mt-3 text-[16px] text-text-secondary">
          {isListing
            ? "Tell us about your clinic and our team will set up your profile and confirm your accreditation details."
            : "Questions, feedback, or a correction? Send us a message and we'll get back to you by email."}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <LeadForm
            type="message"
            source={isListing ? "contact-listing" : "contact"}
            submitLabel="Send message"
            defaultMessage={defaultMessage}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-alt p-5">
            <h2 className="font-display text-[15px] font-semibold text-text-primary">
              Other ways to reach us
            </h2>
            <ul className="mt-3 space-y-3 text-[13.5px] text-text-secondary">
              {contact.email ? (
                <li className="flex items-start gap-2.5">
                  <Mail
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:underline"
                  >
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.phone ? (
                <li className="flex items-start gap-2.5">
                  <Phone
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <a href={`tel:${contact.phone}`} className="hover:underline">
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.address ? (
                <li className="flex items-start gap-2.5">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {contact.address}
                </li>
              ) : null}
              {!contact.email && !contact.phone && !contact.address ? (
                <li className="text-text-muted">
                  Use the form and we&apos;ll reply by email.
                </li>
              ) : null}
            </ul>
          </div>
          <p className="px-1 text-[12px] leading-relaxed text-text-muted">
            {SITE_NAME} is an informational directory, not a medical provider.
            For medical concerns, contact a licensed physician.
          </p>
        </aside>
      </div>

      <section className="prose-article mt-14 max-w-3xl border-t border-border pt-10">
        <h2>What we can help with</h2>
        <p>
          {isListing
            ? `Send us the clinic name, where it operates, which regenerative therapies it offers and which accreditations it holds. We will come back with whatever else the profile needs, usually the issuing bodies behind your accreditations, the physicians who actually perform the procedures, and a price range you are comfortable publishing. Listing is reviewed rather than automatic, and we turn down clinics whose basic details we cannot verify.`
            : `Corrections to a clinic profile. Questions about how a listing or a review was handled. Press and partnership enquiries. Anything to do with your own account or data. If you are reporting something inaccurate, a link to the page plus a line on what is wrong is enough for us to start.`}
        </p>
        <p>
          We reply by email, usually inside two working days. Corrections that
          affect something a page states as fact jump the queue.
        </p>

        <h2>What we cannot help with</h2>
        <p>
          Medical advice, in any form. We cannot recommend a treatment, tell you
          whether a therapy will work for your condition, or read a quote or a
          scan for you. Nobody here is your doctor, and answering those
          questions properly takes someone who knows your history. If you are
          weighing up clinics, take your shortlist and the questions from our{" "}
          <Link href="/faq">FAQ</Link> to someone who does.
        </p>
        <p>
          We also cannot forward a message to a clinic outside the usual route.
          Use the consultation request on the clinic&apos;s own profile, which
          sends your details only to the clinics you pick. And if this is a
          medical emergency, call your local emergency services rather than
          filling in a form.
        </p>

        <h2>Before you write</h2>
        <p>
          The <Link href="/faq">FAQ</Link> already covers a lot of it. So does
          our <Link href="/methodology">methodology</Link>, on how clinics get
          ranked and verified, and the{" "}
          <Link href="/editorial-policy">editorial policy</Link>, on how reviews
          are moderated. Clinics after a listing should start on the{" "}
          <Link href="/for-clinics">for clinics</Link> page. What we do with
          whatever you send us is in the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </div>
  );
}

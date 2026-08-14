import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { SiteSetting } from "@/models";
import { dbConnect } from "@/lib/db";
import { getPageContent } from "@/lib/page-content";
import { StaticPageSchema } from "@/components/seo/static-page-schema";
import { LeadForm } from "@/components/lead/lead-form";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";
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
  const topic = Array.isArray(searchParams.topic)
    ? searchParams.topic[0]
    : searchParams.topic;
  const plan = Array.isArray(searchParams.plan)
    ? searchParams.plan[0]
    : searchParams.plan;

  const isListing = topic === "listing";

  // Clinics arriving from /for-clinics see a different pitch on the same route,
  // so the two copy sets are two registry entries. `/contact/listing` is a
  // variant path: it has its own editor screen but no URL of its own.
  const [content, base] = await Promise.all([
    getPageContent(isListing ? "/contact/listing" : "/contact"),
    // The sidebar copy lives on the main entry either way, so the listing
    // variant does not have to duplicate four fields nobody edits per-variant.
    getPageContent("/contact"),
  ]);

  const contact = await getContact();

  const defaultMessage = isListing
    ? `I'd like to list my clinic on ${SITE_NAME}${plan ? ` (interested in the ${plan} plan)` : ""}.`
    : undefined;

  return (
    <div className="container max-w-4xl py-10 md:py-14">
      {/* `ContactPage`, not a plain `WebPage`: Google reads the two distinctly,
          and the `Organization` node already points `actionableFeedbackPolicy`
          here, so typing the page closes that loop. The listing variant renders
          on this same URL, so the node describes `/contact` either way. */}
      <StaticPageSchema path="/contact" type="ContactPage" />
      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-3 text-[16px]" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <LeadForm
            type="message"
            source={isListing ? "contact-listing" : "contact"}
            submitLabel={content.extra("submitLabel")}
            defaultMessage={defaultMessage}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-alt p-5">
            <h2 className="font-display text-[15px] font-semibold text-text-primary">
              {base.extra("asideTitle")}
            </h2>
            <ul className="mt-3 space-y-3 text-[13.5px] text-text-secondary">
              <ContactDetails
                contact={contact}
                empty={base.extra("asideEmpty")}
              />
            </ul>
          </div>
          <p className="px-1 text-[12px] leading-relaxed text-text-muted">
            {base.extra("asideNote")}
          </p>
        </aside>
      </div>

      <BlockRenderer
        blocks={content.blocks}
        className="mt-14 max-w-3xl border-t border-border pt-10"
      />
    </div>
  );
}

/** The email / phone / address list, or a single fallback line. */
function ContactDetails({
  contact,
  empty,
}: {
  contact: { email?: string; phone?: string; address?: string };
  empty: string;
}) {
  const hasAny = Boolean(contact.email || contact.phone || contact.address);
  if (!hasAny) return <li className="text-text-muted">{empty}</li>;

  return (
    <>
      {contact.email ? (
        <li className="flex items-start gap-2.5">
          <Mail
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <a href={`mailto:${contact.email}`} className="hover:underline">
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
    </>
  );
}

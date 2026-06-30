import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getActivePlans } from "@/lib/public-data";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/common/section";
import { SITE_NAME } from "@/config/site";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "For clinics",
    description: `Get your regenerative-medicine clinic listed on ${SITE_NAME}. Build trust with verification and receive qualified patient inquiries.`,
    path: "/for-clinics",
  });

export default async function ForClinicsPage() {
  const plans = await getActivePlans();

  return (
    <>
      {/* Hero */}
      <section
        className="border-b border-border"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #E1F0FC, #F2F8FD 60%)",
        }}
      >
        <div className="container max-w-3xl py-16 text-center md:py-20">
          <h1 className="font-display text-[clamp(28px,5vw,40px)] font-bold leading-[1.1] tracking-[-0.025em] text-text-primary">
            Reach patients researching regenerative medicine
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-text-secondary">
            List your clinic, build trust with verification, and receive
            qualified consultation requests from patients who are ready to
            connect.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact?topic=listing">Get listed</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="#pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value props */}
      <Section className="border-b border-border">
        <div className="container grid gap-6 md:grid-cols-3">
          <ValueProp
            icon={<Users className="size-5" />}
            title="Qualified inquiries"
            body="Receive consultation requests and matched leads from patients filtered by condition, treatment, and budget."
          />
          <ValueProp
            icon={<ShieldCheck className="size-5" />}
            title="Verified trust signals"
            body="Showcase accreditations and earn a verified badge so patients can shortlist you with confidence."
          />
          <ValueProp
            icon={<TrendingUp className="size-5" />}
            title="Discoverability"
            body="Appear across treatment, condition, and destination pages built to rank in search."
          />
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing">
        <div className="container">
          <SectionHeader
            title="Listing plans"
            description="Start free and upgrade as you grow. Plans are display-only today — our team activates your tier when you get listed."
            className="mx-auto max-w-2xl text-center [&>div]:mx-auto"
          />
          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "flex flex-col rounded-2xl border bg-surface p-6 shadow-card",
                  plan.highlighted
                    ? "border-azure-300 ring-1 ring-azure-200"
                    : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-text-primary">
                    {plan.name}
                  </h3>
                  {plan.highlighted ? (
                    <span className="rounded-sm bg-tint px-2 py-0.5 text-[11px] font-semibold text-azure-700">
                      Most popular
                    </span>
                  ) : null}
                </div>
                {plan.description ? (
                  <p className="mt-1.5 text-[13.5px] text-text-secondary">
                    {plan.description}
                  </p>
                ) : null}
                <div className="mt-5">
                  <span className="font-display text-3xl font-bold tracking-[-0.01em] text-text-primary">
                    {plan.priceMonthly === 0 || plan.priceMonthly == null
                      ? "Free"
                      : formatPrice(plan.priceMonthly, { currency: plan.currency })}
                  </span>
                  {plan.priceMonthly && plan.priceMonthly > 0 ? (
                    <span className="text-[13px] text-text-muted"> /month</span>
                  ) : null}
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[13.5px] text-text-secondary"
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="mt-6 w-full"
                >
                  <Link href={`/contact?topic=listing&plan=${plan.key}`}>
                    {plan.ctaLabel ?? "Get started"}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[12.5px] text-text-muted">
            Pricing is indicative and shown for planning. Billing is handled by
            our team — no payment is collected on this site.
          </p>
        </div>
      </Section>

      {/* CTA band */}
      <Section className="bg-ink">
        <div className="container">
          <div className="flex flex-col items-start justify-between gap-5 rounded-2xl bg-gradient-to-br from-azure-700 to-azure-600 p-8 md:flex-row md:items-center md:p-10">
            <div className="max-w-xl">
              <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-white">
                Ready to get listed?
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/85">
                Tell us about your clinic and our team will set up your profile
                and confirm your accreditation details.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="shrink-0">
              <Link href="/contact?topic=listing">
                Contact our team
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

function ValueProp({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <span className="flex size-10 items-center justify-center rounded-md bg-tint text-azure-700">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-text-primary">
        {title}
      </h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">
        {body}
      </p>
    </div>
  );
}

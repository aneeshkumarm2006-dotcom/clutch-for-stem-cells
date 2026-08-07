import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getActivePlans } from "@/lib/public-data";
import { getPageContent } from "@/lib/page-content";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/common/section";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/for-clinics" });

export default async function ForClinicsPage() {
  const [plans, content] = await Promise.all([
    getActivePlans(),
    getPageContent("/for-clinics"),
  ]);

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
            {content.title}
          </h1>
          <PageLead
            html={content.lead}
            className="mx-auto mt-4 max-w-xl text-[17px]"
          />
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact?topic=listing">
                {content.extra("ctaPrimaryLabel")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="#pricing">{content.extra("ctaSecondaryLabel")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value props — a feature grid by default, but the slot takes any block. */}
      {content.blocks.length ? (
        <Section className="border-b border-border">
          <div className="container max-w-5xl">
            <BlockRenderer blocks={content.blocks} />
          </div>
        </Section>
      ) : null}

      {/* Pricing. The plans themselves are edited in /admin/plans. */}
      <Section id="pricing">
        <div className="container">
          <SectionHeader
            title={content.extra("pricingTitle")}
            description={content.extra("pricingDescription")}
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
          {content.extra("pricingNote") ? (
            <p className="mt-6 text-center text-[12.5px] text-text-muted">
              {content.extra("pricingNote")}
            </p>
          ) : null}
        </div>
      </Section>

      {/* Closing CTA band. */}
      {content.blocksAfter.length ? (
        <Section className="bg-ink">
          <div className="container max-w-5xl">
            <BlockRenderer blocks={content.blocksAfter} />
          </div>
        </Section>
      ) : null}
    </>
  );
}

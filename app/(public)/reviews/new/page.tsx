import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle, CheckCircle2, Star } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getReviewClinic } from "@/lib/public-data";
import { SearchBar } from "@/components/search/search-bar";
import { ReviewForm } from "@/components/review/review-form";
import { EmptyState } from "@/components/ui/empty-state";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Write a review",
    description:
      "Share your experience with a regenerative-medicine clinic. Reviews are email-verified and moderated before they go live.",
    path: "/reviews/new",
  });

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const single = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const clinicSlug = single(searchParams.clinic);
  const confirmed = single(searchParams.confirmed);

  const clinic = clinicSlug ? await getReviewClinic(clinicSlug) : null;

  return (
    <div className="container max-w-2xl py-10 md:py-14">
      <header className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
          Write a review
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">
          Your honest experience helps other patients. Reviews are
          email-verified and checked by our team before they go live.
        </p>
      </header>

      {confirmed === "ok" ? (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-success-bg bg-success-bg/40 p-4 text-sm text-[#07623F]">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            Your email is confirmed. Your review is now with our moderation team
            and will appear once approved.
          </span>
        </div>
      ) : null}
      {confirmed === "invalid" ? (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-danger-bg bg-danger-bg/40 p-4 text-sm text-[#97231F]">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            That confirmation link is invalid or has expired. You can submit your
            review again below.
          </span>
        </div>
      ) : null}

      {clinic ? (
        <ReviewForm
          clinicId={clinic.id}
          clinicName={clinic.name}
          treatments={clinic.treatments}
          conditions={clinic.conditions}
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <EmptyState
            icon={Star}
            title="Which clinic would you like to review?"
            description="Search for the clinic you visited, open its profile, and choose “Write a review”."
          />
          <div className="mt-2 flex justify-center">
            <SearchBar showLocation={false} queryPlaceholder="Search clinics by name" />
          </div>
          <p className="mt-4 text-center text-[13px] text-text-muted">
            Or{" "}
            <Link href="/clinics" className="font-medium text-text-link hover:underline">
              browse all clinics
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

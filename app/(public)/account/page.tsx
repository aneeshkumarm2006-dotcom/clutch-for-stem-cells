import Link from "next/link";
import type { Metadata } from "next";
import { Heart, MessageSquare, Star } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { requireUser } from "@/lib/auth";
import { getMemberLeads, getMemberReviews } from "@/lib/public-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/ui/rating-stars";
import { DeleteAccount } from "@/components/account/delete-account";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "My account",
    description: "Manage your profile, reviews, and inquiries.",
    path: "/account",
    // Private member area — keep it out of the index.
    seo: { noindex: true },
  });

const REVIEW_STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "neutral"
> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  spam: "neutral",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AccountPage() {
  const user = await requireUser("/account");
  const email = user.email ?? "";

  const [reviews, leads] = await Promise.all([
    email ? getMemberReviews(email) : Promise.resolve([]),
    email ? getMemberLeads(email) : Promise.resolve([]),
  ]);

  return (
    <div className="container max-w-4xl py-10 md:py-14">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          My account
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">
          Manage your profile, reviews, and inquiries.
        </p>
      </header>

      {/* Profile */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Profile
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12.5px] text-text-muted">Name</dt>
            <dd className="mt-0.5 text-[14px] text-text-primary">
              {user.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-text-muted">Email</dt>
            <dd className="mt-0.5 text-[14px] text-text-primary">{email}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href="/shortlist">
              <Heart className="size-4" aria-hidden="true" />
              My shortlist
            </Link>
          </Button>
        </div>
      </section>

      {/* My reviews */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-text-primary">
          <Star className="size-5 text-primary" aria-hidden="true" />
          My reviews
        </h2>
        {reviews.length ? (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {r.clinicSlug ? (
                      <Link
                        href={`/clinic/${r.clinicSlug}`}
                        className="font-display text-[14.5px] font-semibold text-text-primary hover:text-primary"
                      >
                        {r.clinicName}
                      </Link>
                    ) : (
                      <span className="font-display text-[14.5px] font-semibold text-text-primary">
                        {r.clinicName}
                      </span>
                    )}
                    <RatingStars value={r.ratingOverall} showValue={false} size={13} />
                  </div>
                  {r.headline ? (
                    <p className="mt-0.5 truncate text-[13px] text-text-secondary">
                      {r.headline}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[12px] text-text-muted">
                    {formatDate(r.createdAt)}
                    {!r.emailVerified ? " · email not confirmed" : ""}
                  </p>
                </div>
                <Badge variant={REVIEW_STATUS_VARIANT[r.status] ?? "neutral"}>
                  {r.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-text-muted">
            You haven&apos;t written any reviews yet.
          </p>
        )}
      </section>

      {/* My inquiries */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-text-primary">
          <MessageSquare className="size-5 text-primary" aria-hidden="true" />
          My inquiries
        </h2>
        {leads.length ? (
          <ul className="space-y-3">
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
              >
                <div>
                  <p className="text-[14px] text-text-primary">
                    {l.clinicName ?? "Clinic match request"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-muted">
                    {l.type} · {formatDate(l.createdAt)}
                  </p>
                </div>
                <Badge variant="neutral">{l.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-text-muted">
            You haven&apos;t made any inquiries yet.
          </p>
        )}
      </section>

      {/* Danger zone */}
      <section className="mt-10 rounded-xl border border-danger-bg bg-danger-bg/30 p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Delete account
        </h2>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-text-secondary">
          Permanently delete your account and personal data. Your published
          reviews stay anonymized to preserve their integrity, but they will no
          longer be linked to you.
        </p>
        <div className="mt-4">
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}

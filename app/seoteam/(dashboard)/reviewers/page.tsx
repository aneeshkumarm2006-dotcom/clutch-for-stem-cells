import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { getAdminReviewers } from "@/lib/seoteam/reviewer-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Medical reviewers | SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReviewersDashboard() {
  const reviewers = await getAdminReviewers();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
            Medical reviewers
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Credentialed people who sign off YMYL content. A real reviewer must
            be assigned before any page can be approved.
          </p>
        </div>
        <Button asChild>
          <Link href="/seoteam/reviewers/new">
            <PlusCircle className="size-4" />
            Add reviewer
          </Link>
        </Button>
      </div>

      {reviewers.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {reviewers.map((r) => (
            <Link
              key={r.id}
              href={`/seoteam/reviewers/${r.id}`}
              className="hover:bg-surface-alt/50 flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <div className="font-medium text-text-primary">
                  {r.name}
                  {r.credentials ? (
                    <span className="text-text-muted">, {r.credentials}</span>
                  ) : null}
                </div>
                {r.title ? (
                  <div className="text-[13px] text-text-secondary">
                    {r.title}
                  </div>
                ) : null}
              </div>
              <Badge variant={r.isActive ? "success" : "neutral"}>
                {r.isActive ? "Active" : "Inactive"}
              </Badge>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
          No reviewers yet. Add a real credentialed reviewer to enable content
          approval.
        </div>
      )}
    </div>
  );
}

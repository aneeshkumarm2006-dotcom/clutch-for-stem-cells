/**
 * Admin dashboard `/admin` (PRD §8.1 / Stage 6.2).
 *
 * KPI cards (clinics by status/tier, pending reviews, new leads), 14-day lead &
 * review trend charts, recent-activity feed, and quick-add buttons.
 */
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/admin/dashboard";
import { describeActivity, type ActivityTone } from "@/lib/admin/activity";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE_DOT: Record<ActivityTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-primary",
  neutral: "bg-slate-500",
};

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={cn("mt-1.5 font-display text-2xl font-semibold", accent)}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-text-secondary">{sub}</div> : null}
    </div>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  const { clinics, leads } = data;

  const maxLeads = Math.max(1, ...data.leadsSeries.map((d) => d.count));
  const maxReviews = Math.max(1, ...data.reviewsSeries.map((d) => d.count));

  // Build the reviews area-chart polyline points (300×120 viewbox).
  const pts = data.reviewsSeries.map((d, i) => {
    const x = (i / Math.max(1, data.reviewsSeries.length - 1)) * 300;
    const y = 110 - (d.count / maxReviews) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <>
      <PageHeader title="Dashboard">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/clinics/new">
            <Plus className="size-4" />
            Add clinic
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/admin/content/articles/new">
            <Plus className="size-4" />
            New article
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-4 p-5 lg:p-7">
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Total clinics"
            value={clinics.total}
            sub={`${clinics.byStatus.published} published · ${clinics.byStatus.pending} pending · ${clinics.byStatus.draft} draft`}
          />
          <Kpi
            label="By tier"
            value={clinics.byTier.featured + clinics.byTier.verified}
            sub={`${clinics.byTier.featured} featured · ${clinics.byTier.verified} verified`}
          />
          <Kpi
            label="Pending reviews"
            value={data.pendingReviews}
            accent={data.pendingReviews > 0 ? "text-warning-fg" : undefined}
            sub="awaiting moderation"
          />
          <Kpi
            label="New leads (7d)"
            value={leads.last7d}
            sub={
              <span
                className={
                  leads.trendPct >= 0 ? "text-success" : "text-danger"
                }
              >
                {leads.trendPct >= 0 ? "+" : ""}
                {leads.trendPct}% vs prior 7d
              </span>
            }
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[15px] font-semibold">
                Leads over time
              </span>
              <span className="text-xs text-text-muted">Last 14 days</span>
            </div>
            <div className="flex h-32 items-end gap-1.5">
              {data.leadsSeries.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/80"
                  style={{ height: `${Math.max(4, (d.count / maxLeads) * 100)}%` }}
                  title={`${d.label}: ${d.count}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[15px] font-semibold">
                Reviews over time
              </span>
              <span className="text-xs text-text-muted">Last 14 days</span>
            </div>
            <svg viewBox="0 0 300 120" className="h-32 w-full" preserveAspectRatio="none">
              <polyline
                points={pts.join(" ")}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
              />
              <polyline
                points={`${pts.join(" ")} 300,120 0,120`}
                fill="var(--tint)"
                opacity="0.5"
                stroke="none"
              />
            </svg>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 font-display text-[15px] font-semibold">
            Recent activity
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              No admin activity yet.
            </p>
          ) : (
            <div className="grid gap-0.5">
              {data.recentActivity.map((a, i) => {
                const d = describeActivity(a.action);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-2.5 text-[13.5px]",
                      i % 2 === 1 && "bg-surface-alt",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 flex-none rounded-full",
                        TONE_DOT[d.tone],
                      )}
                    />
                    <span className="flex-1 text-slate-700">
                      {d.label}{" "}
                      <span className="text-text-muted">by {a.actorName}</span>
                    </span>
                    <span className="text-xs text-text-muted">
                      {timeAgo(a.at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * ClinicAnalyticsPanel — per-clinic engagement metrics for the admin clinic
 * editor (Stage 9.3 / PRD §15). Reads the trailing-window summary from the
 * analytics event store and shows profile views, outbound clicks, leads, and
 * reviews, plus a small profile-views sparkline. PII-free by construction (the
 * store holds only counts). Renders a quiet empty state until events accrue.
 */
import { BarChart3 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { ClinicAnalyticsSummary } from "@/lib/analytics";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-semibold text-text-primary">
        {formatCount(value)}
      </div>
    </div>
  );
}

function Sparkline({ series }: { series: { label: string; count: number }[] }) {
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((d) => d.count));
  const pts = series
    .map((d, i) => {
      const x = (i / (series.length - 1)) * 300;
      const y = 38 - (d.count / max) * 34;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 300 40"
      className="mt-3 h-10 w-full"
      role="img"
      aria-label="Profile views trend"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        className="stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ClinicAnalyticsPanel({
  analytics,
  className,
}: {
  analytics: ClinicAnalyticsSummary;
  className?: string;
}) {
  const hasData =
    analytics.profileViews +
      analytics.outboundClicks +
      analytics.leads +
      analytics.reviews >
    0;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 lg:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-text-muted" aria-hidden="true" />
        <h2 className="font-display text-base font-semibold text-text-primary">
          Engagement
        </h2>
        <span className="ml-auto text-xs text-text-muted">
          Last {analytics.windowDays} days
        </span>
      </div>

      {hasData ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Profile views" value={analytics.profileViews} />
            <Stat label="Website clicks" value={analytics.outboundClicks} />
            <Stat label="Leads" value={analytics.leads} />
            <Stat label="Reviews" value={analytics.reviews} />
          </div>
          <Sparkline series={analytics.viewsSeries} />
        </>
      ) : (
        <p className="mt-4 text-sm text-text-secondary">
          No engagement recorded yet in the last {analytics.windowDays} days.
          Views, clicks, leads, and reviews will appear here as visitors interact
          with this clinic.
        </p>
      )}
    </section>
  );
}

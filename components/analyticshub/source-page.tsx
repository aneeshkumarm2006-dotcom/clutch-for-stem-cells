"use client";

/**
 * Shared per-source page: KPI tiles (sparkline + delta), a fixed multi-line
 * chart of that source's key metrics, and its detail tables. Renders a friendly
 * full-page state when the source is not connected, needs reconnecting, or
 * errored (the provider's message, verbatim).
 */
import { AlertTriangle, PlugZap, RefreshCw } from "lucide-react";
import Link from "next/link";

import { LineChart, type ChartLine } from "@/components/analyticshub/chart";
import { DetailTableView } from "@/components/analyticshub/detail-table";
import { KpiCard } from "@/components/analyticshub/kpi-card";
import {
  KEY_METRICS,
  SOURCE_LABEL,
  metricDef,
} from "@/components/analyticshub/metrics";
import { metricColor } from "@/components/analyticshub/palette";
import { btnPrimary, cardClass } from "@/components/analyticshub/shell-ui";
import {
  ChartSkeleton,
  KpiRowSkeleton,
  TableSkeleton,
} from "@/components/analyticshub/skeleton";
import { useSourceData } from "@/components/analyticshub/use-data";
import type { SourceId, SourceResult } from "@/lib/analyticshub/types";

function seriesFor(
  result: SourceResult,
  key: string,
): { date: string; value: number }[] {
  return result.series
    .filter((p) => p.metric === key)
    .map((p) => ({ date: p.date, value: p.value }));
}

export function SourcePageView({ source }: { source: SourceId }) {
  const { data, loading, error } = useSourceData(source);
  const current = data?.current;
  const previous = data?.previous;

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <KpiRowSkeleton count={KEY_METRICS[source].length} />
        <ChartSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  if (error && !current) {
    return <StateCard variant="error" source={source} message={error} />;
  }
  if (current?.status === "not_connected") {
    return <StateCard variant="not_connected" source={source} />;
  }
  if (current?.status === "reconnect_needed") {
    return (
      <StateCard variant="reconnect" source={source} message={current.error} />
    );
  }
  if (!current || current.status === "error") {
    return (
      <StateCard
        variant="error"
        source={source}
        message={current?.error ?? "Could not load this source."}
      />
    );
  }

  const keys = KEY_METRICS[source];
  const lines: ChartLine[] = keys.map((key) => {
    const def = metricDef(source, key);
    return {
      id: key,
      label: def?.label ?? key,
      color: metricColor(source, key),
      format: def?.format ?? "int",
      points: seriesFor(current, key),
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {keys.map((key) => {
          const def = metricDef(source, key);
          const spark = seriesFor(current, key).map((p) => p.value);
          return (
            <KpiCard
              key={key}
              label={def?.label ?? key}
              value={current.totals[key] ?? 0}
              previous={previous?.totals[key] ?? 0}
              format={def?.format ?? "int"}
              spark={spark}
              color={metricColor(source, key)}
              invert={def?.invertDelta}
            />
          );
        })}
      </div>

      <div className={cardClass}>
        <h2 className="mb-2 font-display text-base font-semibold text-text-primary">
          {SOURCE_LABEL[source]} over time
        </h2>
        <LineChart lines={lines} />
      </div>

      {current.detail?.map((table) => (
        <DetailTableView key={table.id} table={table} />
      ))}
    </div>
  );
}

function StateCard({
  variant,
  source,
  message,
}: {
  variant: "not_connected" | "reconnect" | "error";
  source: SourceId;
  message?: string;
}) {
  const cfg = {
    not_connected: {
      Icon: PlugZap,
      tone: "text-text-secondary",
      title: `${SOURCE_LABEL[source]} isn't connected`,
      body: "Connect it in Settings to see data here.",
    },
    reconnect: {
      Icon: RefreshCw,
      tone: "text-warning",
      title: `${SOURCE_LABEL[source]} needs reconnecting`,
      body: message ?? "The credential expired or was revoked.",
    },
    error: {
      Icon: AlertTriangle,
      tone: "text-danger",
      title: `${SOURCE_LABEL[source]} error`,
      body: message ?? "Something went wrong fetching this source.",
    },
  }[variant];
  const { Icon } = cfg;

  return (
    <div
      className={`${cardClass} flex flex-col items-center justify-center py-16 text-center`}
    >
      <Icon className={`h-8 w-8 ${cfg.tone}`} />
      <h2 className="mt-3 font-display text-lg font-semibold text-text-primary">
        {cfg.title}
      </h2>
      <p className="mt-1 max-w-md text-sm text-text-secondary">{cfg.body}</p>
      <Link href="/analyticshub/settings" className={`mt-5 ${btnPrimary}`}>
        Go to Settings →
      </Link>
    </div>
  );
}

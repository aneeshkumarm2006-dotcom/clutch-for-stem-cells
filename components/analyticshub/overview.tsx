"use client";

/**
 * Overview — "how did we do?" in five seconds: KPI cards with sparkline + delta
 * vs the previous equal period, a multi-select comparison chart (1–5 metrics,
 * persisted), and top-5 strips that link to the deep-dive pages.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LineChart, type ChartLine } from "@/components/analyticshub/chart";
import { KpiCard } from "@/components/analyticshub/kpi-card";
import {
  SOURCE_LABEL,
  SOURCE_ROUTE,
  metricDef,
  metricsFor,
} from "@/components/analyticshub/metrics";
import { metricColor } from "@/components/analyticshub/palette";
import { cardClass } from "@/components/analyticshub/shell-ui";
import {
  ChartSkeleton,
  KpiRowSkeleton,
  TableSkeleton,
} from "@/components/analyticshub/skeleton";
import { useAllData, type AllDataResponse } from "@/components/analyticshub/use-data";
import { cn } from "@/lib/utils";
import type { SourceId, SourceResult } from "@/lib/analyticshub/types";
import { SOURCE_IDS } from "@/lib/analyticshub/types";

const SELECT_KEY = "analyticshub:overview-metrics";

function res(
  data: AllDataResponse | null,
  which: "current" | "previous",
  source: SourceId,
): SourceResult | undefined {
  return data?.[which]?.[source];
}

function seriesFor(result: SourceResult | undefined, key: string) {
  return (result?.series ?? [])
    .filter((p) => p.metric === key)
    .map((p) => ({ date: p.date, value: p.value }));
}

export function OverviewView() {
  const { data, loading } = useAllData();
  const [selected, setSelected] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(SELECT_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSelected(arr.filter((x) => typeof x === "string"));
      } catch {
        /* ignore */
      }
    }
    setRestored(true);
  }, []);

  const connected = useMemo(
    () => SOURCE_IDS.filter((s) => res(data, "current", s)?.status === "ok"),
    [data],
  );

  // Default selection once data + persistence have loaded.
  useEffect(() => {
    if (!restored || !data || selected.length > 0) return;
    const priority = ["users:signups", "ga4:sessions", "gsc:clicks", "meta:spend", "gads:cost"];
    const avail = priority.filter((id) => {
      const [s] = id.split(":");
      return connected.includes(s as SourceId);
    });
    if (avail.length) setSelected(avail.slice(0, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, data, connected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 5
          ? prev
          : [...prev, id];
      window.localStorage.setItem(SELECT_KEY, JSON.stringify(next));
      return next;
    });
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <KpiRowSkeleton count={5} />
        <ChartSkeleton />
        <div className="grid gap-4 lg:grid-cols-3">
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  const adsConnected =
    res(data, "current", "meta")?.status === "ok" ||
    res(data, "current", "gads")?.status === "ok";

  const lines: ChartLine[] = selected
    .map((id): ChartLine | null => {
      const [source, key] = id.split(":") as [SourceId, string];
      const def = metricDef(source, key);
      if (!def) return null;
      return {
        id,
        label: `${SOURCE_LABEL[source]}: ${def.label}`,
        color: metricColor(source, key),
        format: def.format,
        points: seriesFor(res(data, "current", source), key),
      };
    })
    .filter((l): l is ChartLine => l !== null);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <OverviewKpi data={data} source="users" metric="signups" label="New signups" />
        <OverviewKpi data={data} source="ga4" metric="sessions" label="Sessions" />
        <OverviewKpi data={data} source="ga4" metric="keyEvents" label="Conversions" />
        <OverviewKpi data={data} source="gsc" metric="clicks" label="Search clicks" />
        {adsConnected && <CombinedSpendKpi data={data} />}
      </div>

      {/* Comparison chart */}
      <div className={cardClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-text-primary">
            Compare metrics
          </h2>
          <span className="text-xs text-text-muted">{selected.length}/5</span>
        </div>
        <MetricPicker connected={connected} selected={selected} onToggle={toggle} />
        <div className="mt-4">
          {lines.length ? (
            <LineChart lines={lines} height={280} />
          ) : (
            <div className="grid h-40 place-items-center text-sm text-text-muted">
              {connected.length
                ? "Pick a metric above to chart it."
                : "Connect a source in Settings to compare metrics."}
            </div>
          )}
        </div>
      </div>

      {/* Top-5 strips */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TopStrip
          title="Top queries"
          source="gsc"
          data={data}
          detailId="queries"
          valueCol={1}
        />
        <TopStrip
          title="Top pages"
          source="ga4"
          data={data}
          detailId="pages"
          valueCol={1}
        />
        <TopStrip
          title="Recent signups"
          source="users"
          data={data}
          detailId="recent"
          valueCol={3}
        />
      </div>
    </div>
  );
}

function OverviewKpi({
  data,
  source,
  metric,
  label,
}: {
  data: AllDataResponse | null;
  source: SourceId;
  metric: string;
  label: string;
}) {
  const current = res(data, "current", source);
  const previous = res(data, "previous", source);
  const def = metricDef(source, metric);
  if (current?.status !== "ok") {
    return <MutedKpi label={label} source={source} />;
  }
  return (
    <KpiCard
      label={label}
      value={current.totals[metric] ?? 0}
      previous={previous?.totals[metric] ?? 0}
      format={def?.format ?? "int"}
      spark={seriesFor(current, metric).map((p) => p.value)}
      color={metricColor(source, metric)}
      invert={def?.invertDelta}
    />
  );
}

function CombinedSpendKpi({ data }: { data: AllDataResponse | null }) {
  const specs: { source: SourceId; key: string }[] = [
    { source: "meta", key: "spend" },
    { source: "gads", key: "cost" },
  ];
  const sum = (which: "current" | "previous") =>
    specs.reduce((t, s) => t + (res(data, which, s.source)?.totals[s.key] ?? 0), 0);
  const byDate = new Map<string, number>();
  for (const s of specs) {
    for (const p of res(data, "current", s.source)?.series ?? []) {
      if (p.metric === s.key) {
        byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
      }
    }
  }
  const spark = [...byDate.entries()].sort().map(([, v]) => v);
  return (
    <KpiCard
      label="Ad spend"
      value={sum("current")}
      previous={sum("previous")}
      format="currency"
      spark={spark}
      color={metricColor("gads", "cost")}
      invert
    />
  );
}

function MutedKpi({ label, source }: { label: string; source: SourceId }) {
  return (
    <Link
      href="/analyticshub/settings"
      className="flex flex-col justify-between rounded-xl border border-dashed border-border bg-surface p-4 text-text-muted transition-colors hover:border-primary hover:text-text-secondary"
    >
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      <span className="mt-2 text-sm">Connect {SOURCE_LABEL[source]} →</span>
    </Link>
  );
}

function MetricPicker({
  connected,
  selected,
  onToggle,
}: {
  connected: SourceId[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (!connected.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {connected.map((source) => (
        <div key={source} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {SOURCE_LABEL[source]}
          </span>
          {metricsFor(source).map((m) => {
            const id = `${source}:${m.key}`;
            const on = selected.includes(id);
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                disabled={!on && selected.length >= 5}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                  on
                    ? "border-transparent text-text-primary"
                    : "border-border text-text-secondary hover:bg-surface-alt",
                )}
                style={on ? { background: `${metricColor(source, m.key)}22` } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: metricColor(source, m.key) }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TopStrip({
  title,
  source,
  data,
  detailId,
  valueCol,
}: {
  title: string;
  source: SourceId;
  data: AllDataResponse | null;
  detailId: string;
  valueCol: number;
}) {
  const current = res(data, "current", source);
  const table = current?.detail?.find((t) => t.id === detailId);
  const rows = table?.rows.slice(0, 5) ?? [];
  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text-primary">
          {title}
        </h3>
        <Link
          href={SOURCE_ROUTE[source]}
          className="text-xs font-medium text-text-link hover:underline"
        >
          view page →
        </Link>
      </div>
      {current?.status !== "ok" ? (
        <p className="py-6 text-center text-sm text-text-muted">
          {SOURCE_LABEL[source]} not connected.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">No data yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-text-secondary">
                {row[0]}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-text-primary">
                {row[valueCol]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

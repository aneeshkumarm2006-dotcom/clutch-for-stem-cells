"use client";

/**
 * Data hooks — fetch a single source (current + previous range) or all sources,
 * re-running whenever the range or the refresh signal changes. `busting` adds
 * `refresh=1` so the manual Refresh button bypasses the 6-hour cache.
 */
import { useEffect, useState } from "react";

import { ApiError, apiGet } from "@/components/analyticshub/api";
import { useHub } from "@/components/analyticshub/context";
import type {
  DateRange,
  SourceId,
  SourceResult,
} from "@/lib/analyticshub/types";

export interface SingleDataResponse {
  range: DateRange;
  previousRange: DateRange;
  current: SourceResult;
  previous: SourceResult;
}

export interface AllDataResponse {
  range: DateRange;
  previousRange: DateRange;
  current: Record<string, SourceResult>;
  previous: Record<string, SourceResult>;
}

function toMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "Failed to load data.";
}

export function useSourceData(source: SourceId): {
  data: SingleDataResponse | null;
  loading: boolean;
  error: string | null;
} {
  const { range, refreshNonce, busting, markLoaded } = useHub();
  const [data, setData] = useState<SingleDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { from: range.from, to: range.to };
    if (busting) params.refresh = "1";
    apiGet<SingleDataResponse>(`data/${source}`, params)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(toMessage(e));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          markLoaded();
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, range.from, range.to, refreshNonce]);

  return { data, loading, error };
}

export function useAllData(): {
  data: AllDataResponse | null;
  loading: boolean;
  error: string | null;
} {
  const { range, refreshNonce, busting, markLoaded } = useHub();
  const [data, setData] = useState<AllDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { from: range.from, to: range.to };
    if (busting) params.refresh = "1";
    apiGet<AllDataResponse>("data/all", params)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(toMessage(e));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          markLoaded();
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, refreshNonce]);

  return { data, loading, error };
}

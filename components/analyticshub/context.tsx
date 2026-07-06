"use client";

/**
 * Hub context — the single source every page reads for the active date range,
 * refresh signal, and connection status. Lives in the persistent client shell
 * so it survives sidebar navigation (App Router keeps the layout mounted).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiGet } from "@/components/analyticshub/api";
import type { DateRange, HubStatusView } from "@/lib/analyticshub/types";

export type Preset = "today" | "yesterday" | "7" | "28" | "90";

/** Which top-level screen the shell shows. Set once from status, then only by
 * explicit user transitions (login, wizard finish, sign out) so a background
 * status reload never yanks the user off the wizard. */
export type Screen = "config" | "wizard" | "login" | "app";

export const PRESETS: { id: Preset; label: string; short: string }[] = [
  { id: "today", label: "Today", short: "Today" },
  { id: "yesterday", label: "Yesterday", short: "Yest." },
  { id: "7", label: "Last 7 days", short: "7d" },
  { id: "28", label: "Last 28 days", short: "28d" },
  { id: "90", label: "Last 90 days", short: "90d" },
];

const PRESET_KEY = "analyticshub:preset";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function rangeForPreset(preset: Preset): DateRange {
  const end = new Date();
  const start = new Date();
  switch (preset) {
    case "today":
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "7":
      start.setDate(start.getDate() - 6);
      break;
    case "28":
      start.setDate(start.getDate() - 27);
      break;
    case "90":
      start.setDate(start.getDate() - 89);
      break;
  }
  return { from: ymd(start), to: ymd(end) };
}

interface HubContextValue {
  status: HubStatusView | null;
  statusLoading: boolean;
  reloadStatus: () => Promise<void>;
  screen: Screen | null;
  setScreen: (s: Screen) => void;
  preset: Preset;
  setPreset: (p: Preset) => void;
  range: DateRange;
  refreshNonce: number;
  busting: boolean;
  refresh: () => void;
  markLoaded: () => void;
  lastUpdated: number | null;
}

const Ctx = createContext<HubContextValue | null>(null);

export function useHub(): HubContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHub must be used inside HubProvider");
  return v;
}

export function HubProvider({
  initialStatus,
  children,
}: {
  initialStatus: HubStatusView | null;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<HubStatusView | null>(initialStatus);
  const [statusLoading, setStatusLoading] = useState(false);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [preset, setPresetState] = useState<Preset>("7");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [busting, setBusting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Restore the persisted preset once on mount (client-only).
  useEffect(() => {
    const saved = window.localStorage.getItem(PRESET_KEY) as Preset | null;
    if (saved && PRESETS.some((p) => p.id === saved)) setPresetState(saved);
  }, []);

  // Derive the initial screen exactly once, when status first arrives.
  useEffect(() => {
    if (!status || screen !== null) return;
    if (!status.secretOk || !status.dbOk) setScreen("config");
    else if (!status.setup) setScreen("wizard");
    else if (!status.authed) setScreen("login");
    else setScreen("app");
  }, [status, screen]);

  const setPreset = useCallback((p: Preset) => {
    setPresetState(p);
    window.localStorage.setItem(PRESET_KEY, p);
  }, []);

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  const reloadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      setStatus(await apiGet<HubStatusView>("status"));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Load status on mount unless the server already provided it.
  useEffect(() => {
    if (!initialStatus) void reloadStatus();
  }, [initialStatus, reloadStatus]);

  const refresh = useCallback(() => {
    setBusting(true);
    setRefreshNonce((n) => n + 1);
  }, []);

  const markLoaded = useCallback(() => {
    setBusting(false);
    setLastUpdated(Date.now());
  }, []);

  const value = useMemo<HubContextValue>(
    () => ({
      status,
      statusLoading,
      reloadStatus,
      screen,
      setScreen,
      preset,
      setPreset,
      range,
      refreshNonce,
      busting,
      refresh,
      markLoaded,
      lastUpdated,
    }),
    [
      status,
      statusLoading,
      reloadStatus,
      screen,
      preset,
      setPreset,
      range,
      refreshNonce,
      busting,
      refresh,
      markLoaded,
      lastUpdated,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

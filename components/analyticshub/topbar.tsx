"use client";

import { LogOut, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";

import { apiPost } from "@/components/analyticshub/api";
import { PRESETS, useHub } from "@/components/analyticshub/context";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/analyticshub": "Overview",
  "/analyticshub/ga4": "Analytics",
  "/analyticshub/gsc": "Search Console",
  "/analyticshub/meta": "Meta Ads",
  "/analyticshub/gads": "Google Ads",
  "/analyticshub/users": "Users",
  "/analyticshub/settings": "Settings",
};

function updatedLabel(ts: number | null): string {
  if (!ts) return "";
  return `Updated ${new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function Topbar() {
  const pathname = usePathname();
  const { preset, setPreset, refresh, busting, lastUpdated, reloadStatus } =
    useHub();

  async function signOut() {
    await apiPost("logout").catch(() => {});
    await reloadStatus();
  }

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-3">
      <h1 className="font-display text-lg font-semibold text-text-primary">
        {TITLES[pathname] ?? "Analytics"}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-surface-alt p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                preset === p.id
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <span className="hidden sm:inline">{p.label}</span>
              <span className="sm:hidden">{p.short}</span>
            </button>
          ))}
        </div>

        {lastUpdated && (
          <span className="hidden whitespace-nowrap text-xs text-text-muted lg:inline">
            {updatedLabel(lastUpdated)}
          </span>
        )}

        <button
          onClick={refresh}
          title="Refresh (bypass cache)"
          aria-label="Refresh"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
        >
          <RefreshCw className={cn("h-4 w-4", busting && "animate-spin")} />
        </button>

        <button
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

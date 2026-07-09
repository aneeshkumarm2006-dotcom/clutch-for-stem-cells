"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

import {
  runSeoChecks,
  seoReadiness,
  type CheckStatus,
  type SeoCheckInput,
} from "@/lib/seoteam/seo-checks";

const ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="size-4 flex-none text-success" />,
  warn: <AlertTriangle className="size-4 flex-none text-warning" />,
  fail: <XCircle className="size-4 flex-none text-danger" />,
};

/**
 * Live, on-page SEO checks (§6) shown beside the editor.
 *
 * Every warn/fail check can be manually "checked off": the editor decides an
 * item is fine as-is, clicks it, and the roll-up then counts it as passing.
 * Overrides are remembered per post (localStorage, when a `storageKey` is
 * given) and self-clear once a check passes on its own — so a stale override
 * never silently hides a *new* problem.
 */
export function SeoCheckPanel({
  input,
  storageKey,
}: {
  input: SeoCheckInput;
  storageKey?: string;
}) {
  const checks = React.useMemo(() => runSeoChecks(input), [input]);

  const [overrides, setOverrides] = React.useState<Set<string>>(
    () => new Set(),
  );

  // Load remembered overrides after mount (keeps the SSR markup override-free
  // so it matches the server render, then hydrates the saved state).
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setOverrides(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore malformed / unavailable storage */
    }
  }, [storageKey]);

  // Persist on change. Skip the first run so mounting doesn't clobber what the
  // load effect is about to read back in.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...overrides]));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [overrides, storageKey]);

  // Drop overrides for checks that now pass on their own — an override only
  // means anything while its check is warn/fail. This also means that if the
  // content later regresses, the real problem surfaces again instead of staying
  // silently marked OK.
  React.useEffect(() => {
    setOverrides((cur) => {
      let changed = false;
      const next = new Set(cur);
      for (const c of checks) {
        if (c.status === "pass" && next.has(c.id)) {
          next.delete(c.id);
          changed = true;
        }
      }
      return changed ? next : cur;
    });
  }, [checks]);

  const toggle = (id: string) =>
    setOverrides((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Effective status (override → pass) drives both the icons and the summary.
  const effective = React.useMemo(
    () =>
      checks.map((c) =>
        overrides.has(c.id) ? { ...c, status: "pass" as CheckStatus } : c,
      ),
    [checks, overrides],
  );
  const summary = React.useMemo(() => seoReadiness(effective), [effective]);
  const overriddenCount = checks.filter(
    (c) => c.status !== "pass" && overrides.has(c.id),
  ).length;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg px-3 py-2 text-[12.5px] font-medium ${
          summary.fail > 0
            ? "bg-danger-bg text-[#97231F]"
            : summary.warn > 0
              ? "bg-warning-bg text-[#8A5A00]"
              : "bg-success-bg text-[#07623F]"
        }`}
      >
        {summary.fail > 0
          ? `${summary.fail} issue${summary.fail > 1 ? "s" : ""} to fix before this is SEO-ready.`
          : summary.warn > 0
            ? `Looks good — ${summary.warn} optional improvement${summary.warn > 1 ? "s" : ""}.`
            : "SEO-ready ✓"}
        {overriddenCount > 0 ? (
          <span className="mt-0.5 block text-[11.5px] font-normal opacity-80">
            {overriddenCount} check{overriddenCount > 1 ? "s" : ""} marked OK
            manually.
          </span>
        ) : null}
      </div>

      <ul className="space-y-2.5">
        {checks.map((check) => {
          const overridden = overrides.has(check.id);
          // Only warn/fail items are override-able; a genuine pass needs no action.
          const overridable = check.status !== "pass";
          const shownStatus: CheckStatus = overridden ? "pass" : check.status;

          return (
            <li key={check.id} className="flex items-start gap-2">
              {overridable ? (
                <button
                  type="button"
                  onClick={() => toggle(check.id)}
                  aria-pressed={overridden}
                  title={
                    overridden ? "Marked OK — click to undo" : "Mark this as OK"
                  }
                  className="flex-none rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {ICON[shownStatus]}
                </button>
              ) : (
                ICON[check.status]
              )}

              <div className="min-w-0">
                <div className="text-[13px] font-medium text-text-primary">
                  {check.label}
                </div>
                <div className="text-[12px] leading-snug text-text-muted">
                  {check.message}
                </div>
                {overridable ? (
                  <button
                    type="button"
                    onClick={() => toggle(check.id)}
                    className="mt-0.5 text-[11px] font-medium text-text-link hover:underline"
                  >
                    {overridden ? "✓ Marked OK · Undo" : "Mark as OK"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

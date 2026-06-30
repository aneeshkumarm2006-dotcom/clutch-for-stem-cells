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

/** Live, on-page SEO checks (§6) shown beside the editor. */
export function SeoCheckPanel({ input }: { input: SeoCheckInput }) {
  const checks = React.useMemo(() => runSeoChecks(input), [input]);
  const summary = React.useMemo(() => seoReadiness(checks), [checks]);

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
      </div>

      <ul className="space-y-2.5">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            {ICON[check.status]}
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-text-primary">
                {check.label}
              </div>
              <div className="text-[12px] leading-snug text-text-muted">
                {check.message}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

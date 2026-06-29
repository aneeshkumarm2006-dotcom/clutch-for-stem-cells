import * as React from "react";

import { CellMark } from "@/components/brand/logo";

/**
 * Auth card shell — Stage 2.5 (matches `Auth.dc.html`).
 *
 * Azure radial-wash panel → centered cell mark + title + subtitle → a white
 * inner panel holding the form (`children`) → an optional footer line.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="w-full max-w-[420px] rounded border border-border p-9 shadow-sm sm:px-9 sm:py-12"
      style={{
        background:
          "radial-gradient(120% 70% at 50% -12%, #E1F0FC, #F2F8FD 60%)",
      }}
    >
      <div className="mb-6 text-center">
        <span className="mb-3.5 inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <CellMark size={22} />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
          {title}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        {children}
      </div>

      {footer ? (
        <p className="mt-[18px] text-center text-[13.5px] text-text-secondary">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

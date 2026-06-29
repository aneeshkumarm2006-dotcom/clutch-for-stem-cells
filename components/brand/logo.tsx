import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/config/site";

/**
 * Logo — Design §2. Concentric-circle "cell" glyph in an azure rounded square
 * + "StemConnect" wordmark (Plus Jakarta Sans 700, single weight).
 */

type LogoSize = "sm" | "md" | "lg";

const MARK_SIZE: Record<LogoSize, number> = { sm: 26, md: 30, lg: 36 };
const WORDMARK_CLASS: Record<LogoSize, string> = {
  sm: "text-[17px]",
  md: "text-[19px]",
  lg: "text-[22px]",
};

export interface LogoProps extends React.HTMLAttributes<HTMLElement> {
  /** Render the mark only (no wordmark). */
  markOnly?: boolean;
  /** Wrap in a link to home. Pass `false` to render inline (e.g. in footer). */
  href?: string | false;
  size?: LogoSize;
  /** Monochrome lockup for dark surfaces (footer) — mark + wordmark in white. */
  mono?: "white" | "ink";
}

export function CellMark({
  size = 30,
  className,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="8.4" cy="9" r="1" />
    </svg>
  );
}

export function Logo({
  markOnly = false,
  href = "/",
  size = "md",
  mono,
  className,
  ...props
}: LogoProps) {
  const markPx = MARK_SIZE[size];

  const markBox = mono
    ? "bg-transparent"
    : "bg-primary text-primary-foreground shadow-xs";

  const content = (
    <span className={cn("inline-flex items-center gap-[9px]", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          mono === "white" && "text-white",
          mono === "ink" && "text-ink",
          markBox,
        )}
        style={{ width: markPx, height: markPx, borderRadius: 8 }}
      >
        <CellMark size={Math.round(markPx * 0.62)} />
      </span>
      {!markOnly && (
        <span
          className={cn(
            "font-display font-bold tracking-[-0.01em]",
            WORDMARK_CLASS[size],
            mono === "white" ? "text-white" : "text-ink",
          )}
        >
          {SITE_NAME}
        </span>
      )}
    </span>
  );

  if (href === false) return content;

  return (
    <Link
      href={href}
      aria-label={`${SITE_NAME} home`}
      className="inline-flex rounded-md focus-visible:outline-none"
      {...props}
    >
      {content}
    </Link>
  );
}

export default Logo;

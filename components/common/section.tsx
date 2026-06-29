import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * SectionHeader — a homepage/landing section title row: optional eyebrow label,
 * an `h2` title, an optional one-line description, and an optional "see all"
 * link on the right (Design §4.2 / §13 sentence-case).
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  link,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  link?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-azure-700">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[28px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-text-link transition-colors hover:text-primary"
        >
          {link.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/** A major page section with consistent vertical rhythm (Design §5.2). */
export function Section({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("py-12 md:py-16", className)} {...props}>
      {children}
    </section>
  );
}

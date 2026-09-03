import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { ToolIcon } from "@/components/tools/tool-icon";
import { toolPath, type ToolDef } from "@/config/tools";

/**
 * One calculator on the hub or in a related-tools strip.
 *
 * The whole card is the link rather than a "Learn more" affordance at the
 * bottom, which is both a bigger target and one stop in the tab order instead
 * of two that go to the same place.
 */
export function ToolCard({
  tool,
  className,
}: {
  tool: ToolDef;
  className?: string;
}) {
  return (
    <Link
      href={toolPath(tool.slug)}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-surface-alt",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-tint text-azure-700">
        <ToolIcon icon={tool.icon} className="size-[18px]" />
      </span>
      <h3 className="mt-3 font-display text-[16px] font-semibold leading-snug tracking-[-0.01em] text-text-primary">
        {tool.name}
      </h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-secondary">
        {tool.blurb}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-text-link">
        Open
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

/** The related-tools strip at the foot of a calculator page. */
export function RelatedTools({
  tools,
  heading = "Related calculators",
}: {
  tools: ToolDef[];
  heading?: string;
}) {
  if (!tools.length) return null;
  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-text-primary">
        {heading}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}

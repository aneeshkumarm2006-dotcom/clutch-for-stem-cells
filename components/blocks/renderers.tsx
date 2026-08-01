/**
 * Public renderers for each content block.
 *
 * Server components (no interactivity needed), styled with the same Azure
 * Clinical tokens as the rest of the site so a composed page is visually
 * indistinguishable from a hand-built one.
 *
 * HTML-bearing blocks (`richText`, `rawHtml`) render already-sanitized HTML —
 * `sanitizeBlogHtml` runs on every write, so the string in the DB is safe by the
 * time it gets here. Sanitizing again at render would be redundant work on the
 * hot path.
 */
import * as React from "react";
import Link from "next/link";
import { RemoteImage } from "@/components/common/remote-image";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Info,
  Lightbulb,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CALLOUT_TONE_LABELS, type CalloutTone } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type {
  CalloutBlock,
  ChecklistBlock,
  ComparisonBlock,
  CtaBlock,
  FaqBlock,
  FeatureGridBlock,
  KeyTakeawaysBlock,
  LinkListBlock,
  MediaBlock,
  ProsConsBlock,
  QuoteBlock,
  RawHtmlBlock,
  RichTextBlock,
  StatGridBlock,
  StepsBlock,
} from "@/lib/validation/block";

/** Shared section heading so every block's title looks the same. */
function BlockHeading({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">
      {children}
    </h2>
  );
}

/** Optional lead-in prose above a block's list/table body. */
function BlockIntro({ children }: { children?: string }) {
  if (!children?.trim()) return null;
  return (
    <p className="mb-4 whitespace-pre-line text-[14.5px] leading-relaxed text-text-secondary">
      {children}
    </p>
  );
}

/** Optional qualifying line below a block's body. */
function BlockFootnote({ children }: { children?: string }) {
  if (!children?.trim()) return null;
  return (
    <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
      {children}
    </p>
  );
}

/** Short hostname for a citation link, e.g. "pubmed.ncbi.nlm.nih.gov" → "pubmed". */
function sourceLabel(url: string): string {
  if (!/^https?:\/\//i.test(url)) return "source";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] || "source";
  } catch {
    return "source";
  }
}

export function RichTextRenderer({ data }: { data: RichTextBlock }) {
  if (!data.html?.trim()) return null;
  return (
    <div
      className="prose-article"
      // Sanitized on save (lib/seoteam/sanitize.ts).
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: data.html }}
    />
  );
}

/**
 * Answer-first summary. Tinted and bulleted so a reader (and an answer engine)
 * gets the whole point of the section without reading the prose under it.
 */
export function KeyTakeawaysRenderer({ data }: { data: KeyTakeawaysBlock }) {
  const items = data.items.filter((i) => i.trim());
  if (!items.length) return null;

  return (
    <section className="rounded-xl border border-border bg-tint p-5">
      <p className="font-display text-[15px] font-semibold text-text-primary">
        {data.title ?? "Key takeaways"}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-text-secondary"
          >
            <span
              aria-hidden="true"
              className="mt-[7px] size-1.5 shrink-0 rounded-full bg-azure-700"
            />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * An ordered process. `<ol>` rather than styled divs so the sequence survives
 * for screen readers and for anything scraping the page as plain text.
 */
export function StepsRenderer({ data }: { data: StepsBlock }) {
  const steps = data.steps.filter((s) => s.title.trim());
  if (!steps.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      <BlockIntro>{data.intro}</BlockIntro>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={i}
            className="flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4"
          >
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tint font-display text-[13px] font-semibold text-azure-700"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-medium leading-relaxed text-text-primary">
                {step.title}
              </p>
              {step.description ? (
                <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <BlockFootnote>{data.footnote}</BlockFootnote>
    </section>
  );
}

/** Ticked bullets — "what to compare", "what to ask", "what to bring". */
export function ChecklistRenderer({ data }: { data: ChecklistBlock }) {
  const items = data.items.filter((i) => i.trim());
  if (!items.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      <BlockIntro>{data.intro}</BlockIntro>
      <ul className="grid gap-2.5 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-text-secondary"
          >
            <Check
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-success"
            />
            {item}
          </li>
        ))}
      </ul>
      <BlockFootnote>{data.footnote}</BlockFootnote>
    </section>
  );
}

/** Sourced numbers, rendered large. Citations are visible, never implied. */
export function StatGridRenderer({ data }: { data: StatGridBlock }) {
  const stats = data.stats.filter((s) => s.value.trim() && s.label.trim());
  if (!stats.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <p className="font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-text-primary">
              {stat.value}
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
              {stat.label}
            </p>
            {stat.sourceUrl ? (
              <a
                href={stat.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 inline-flex items-center gap-0.5 text-[12px] text-text-link hover:underline"
              >
                {sourceLabel(stat.sourceUrl)}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Per-tone styling for a callout. Kept flat so Tailwind can see every class. */
const CALLOUT_STYLES: Record<
  CalloutTone,
  { box: string; icon: string; Icon: typeof Info }
> = {
  note: {
    box: "border-border bg-surface-alt",
    icon: "text-text-secondary",
    Icon: Info,
  },
  tip: {
    box: "border-border bg-tint",
    icon: "text-azure-700",
    Icon: Lightbulb,
  },
  important: {
    box: "border-azure-700/30 bg-tint",
    icon: "text-azure-700",
    Icon: Info,
  },
  caution: {
    box: "border-warning/40 bg-warning/10",
    icon: "text-warning",
    Icon: TriangleAlert,
  },
};

/** A note set apart from the prose — caveats, scope limits, safety framing. */
export function CalloutRenderer({ data }: { data: CalloutBlock }) {
  if (!data.body?.trim() && !data.title?.trim()) return null;
  const { box, icon, Icon } = CALLOUT_STYLES[data.tone];

  return (
    <aside className={cn("flex gap-3 rounded-xl border p-4", box)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0">
        <p className="font-display text-[14px] font-semibold text-text-primary">
          {data.title ?? CALLOUT_TONE_LABELS[data.tone]}
        </p>
        {data.body?.trim() ? (
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-text-secondary">
            {data.body}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/** Pull quote with attribution. */
export function QuoteRenderer({ data }: { data: QuoteBlock }) {
  if (!data.quote?.trim()) return null;

  return (
    <figure className="border-l-2 border-azure-700 pl-5">
      <blockquote className="font-display text-[17px] leading-relaxed text-text-primary">
        {data.quote}
      </blockquote>
      {data.attribution ? (
        <figcaption className="mt-2.5 text-[13px] text-text-muted">
          {data.sourceUrl ? (
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-text-link hover:underline"
            >
              {data.attribution}
            </a>
          ) : (
            data.attribution
          )}
          {data.role ? `, ${data.role}` : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Related reading. Internal links are `next/link`; external ones open away. */
export function LinkListRenderer({ data }: { data: LinkListBlock }) {
  const links = data.links.filter((l) => l.label.trim() && l.href.trim());
  if (!links.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {links.map((link, i) => {
          const external = /^https?:\/\//i.test(link.href);
          const inner = (
            <>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium text-text-primary">
                  {link.label}
                </span>
                {link.description ? (
                  <span className="mt-0.5 block text-[13.5px] leading-relaxed text-text-secondary">
                    {link.description}
                  </span>
                ) : null}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-text-muted"
              />
            </>
          );
          const className =
            "flex items-start justify-between gap-3 p-4 transition-colors hover:bg-surface-alt";
          return (
            <li key={i}>
              {external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {inner}
                </a>
              ) : (
                <Link href={link.href} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FaqRenderer({ data }: { data: FaqBlock }) {
  const items = data.items.filter((i) => i.question.trim() && i.answer.trim());
  if (!items.length) return null;

  return (
    <section>
      <BlockHeading>{data.title ?? "Frequently asked questions"}</BlockHeading>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((item, i) => (
          <details key={i} className="group p-4">
            {/* `list-none` kills the standard marker (Firefox/Safari); the
                `::-webkit-details-marker` rule kills the Chrome/older-Safari
                one. Without both, a stray triangle sits beside the `+`. */}
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-[15px] font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                aria-hidden="true"
                className="shrink-0 text-text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-text-secondary">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ComparisonRenderer({ data }: { data: ComparisonBlock }) {
  const rows = data.rows.filter((r) => r.label.trim());
  if (!rows.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      {/* Wide tables scroll inside their own container, never the page body. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[520px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left">
              <th className="p-3 font-display text-[13px] font-semibold text-text-primary" />
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  className="p-3 font-display text-[13px] font-semibold text-text-primary"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <th
                  scope="row"
                  className="p-3 text-left font-display text-[13.5px] font-semibold text-text-primary"
                >
                  {row.url ? (
                    <Link href={row.url} className="text-text-link hover:underline">
                      {row.label}
                    </Link>
                  ) : (
                    row.label
                  )}
                </th>
                {data.columns.map((_, c) => (
                  <td key={c} className="p-3 align-top text-text-secondary">
                    {row.cells[c] ?? "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FeatureGridRenderer({ data }: { data: FeatureGridBlock }) {
  const items = data.items.filter((i) => i.title.trim());
  if (!items.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <p className="font-display text-[15px] font-semibold text-text-primary">
              {item.title}
            </p>
            {item.description ? (
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">
                {item.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProsConsRenderer({ data }: { data: ProsConsBlock }) {
  const pros = data.pros.filter((p) => p.trim());
  const cons = data.cons.filter((c) => c.trim());
  if (!pros.length && !cons.length) return null;

  return (
    <section>
      <BlockHeading>{data.title}</BlockHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <ProsConsColumn title="Pros" items={pros} tone="pro" />
        <ProsConsColumn title="Cons" items={cons} tone="con" />
      </div>
    </section>
  );
}

function ProsConsColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "pro" | "con";
}) {
  if (!items.length) return null;
  const Icon = tone === "pro" ? Check : X;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-2.5 font-display text-[13px] font-semibold text-text-primary">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[14px] leading-relaxed text-text-secondary"
          >
            <Icon
              aria-hidden="true"
              className={
                tone === "pro"
                  ? "mt-0.5 size-4 shrink-0 text-success"
                  : "mt-0.5 size-4 shrink-0 text-danger"
              }
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CtaRenderer({ data }: { data: CtaBlock }) {
  if (!data.title?.trim() || !data.buttonLabel?.trim()) return null;

  return (
    <section className="rounded-xl border border-border bg-tint p-6 text-center">
      <p className="font-display text-lg font-semibold text-text-primary">
        {data.title}
      </p>
      {data.body ? (
        <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">
          {data.body}
        </p>
      ) : null}
      <Button asChild className="mt-4">
        <Link href={data.buttonHref}>{data.buttonLabel}</Link>
      </Button>
    </section>
  );
}

export function MediaRenderer({ data }: { data: MediaBlock }) {
  if (!data.image?.url) return null;

  return (
    <figure>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-tint">
        <RemoteImage
          src={data.image.url}
          alt={data.image.alt ?? ""}
          fill
          sizes="(min-width: 1024px) 720px, 100vw"
          className="object-cover"
        />
      </div>
      {data.caption ? (
        <figcaption className="mt-2 text-center text-[13px] text-text-muted">
          {data.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function RawHtmlRenderer({ data }: { data: RawHtmlBlock }) {
  if (!data.html?.trim()) return null;
  return (
    <div
      className="[&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-xl"
      // Sanitized on save — the allow-list permits embeds (iframes) here.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: data.html }}
    />
  );
}

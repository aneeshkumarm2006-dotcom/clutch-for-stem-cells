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
import Image from "next/image";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  ComparisonBlock,
  CtaBlock,
  FaqBlock,
  FeatureGridBlock,
  MediaBlock,
  ProsConsBlock,
  RawHtmlBlock,
  RichTextBlock,
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

export function FaqRenderer({ data }: { data: FaqBlock }) {
  const items = data.items.filter((i) => i.question.trim() && i.answer.trim());
  if (!items.length) return null;

  return (
    <section>
      <BlockHeading>{data.title ?? "Frequently asked questions"}</BlockHeading>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((item, i) => (
          <details key={i} className="group p-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 font-display text-[15px] font-semibold text-text-primary">
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
        <Image
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

"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResultPanel,
  Segmented,
  ToolNote,
  ToolPanel,
} from "@/components/tools/tool-ui";
import { formatPrice } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/config/site";
import {
  COMPARISON_FOCUSES,
  REFERENCE_AS_OF,
  comparisonRows,
  comparisonSpread,
  focusByKey,
  type ComparisonOption,
  type OptionKind,
} from "@/lib/tools/comparison";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<OptionKind, string> = {
  none: "No procedure",
  conventional: "Conventional injection",
  regenerative: "Regenerative",
  surgical: "Surgical",
};

const KIND_STYLES: Record<OptionKind, string> = {
  none: "bg-surface-alt text-text-secondary",
  conventional: "bg-surface-alt text-text-secondary",
  regenerative: "bg-tint text-azure-700",
  surgical: "bg-warning-bg text-warning-fg",
};

/** The fields the stacked mobile card repeats from the table. */
const MOBILE_FIELDS: { key: keyof ComparisonOption; label: string }[] = [
  { key: "recovery", label: "Recovery" },
  { key: "course", label: "Typical course" },
  { key: "durability", label: "How long it lasts" },
  { key: "insurance", label: "Insurance" },
  { key: "evidence", label: "Evidence" },
];

function KindPill({ kind }: { kind: OptionKind }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
        KIND_STYLES[kind],
      )}
    >
      {KIND_LABELS[kind]}
    </span>
  );
}

/**
 * Treatment options side by side.
 *
 * Two things this table refuses to do, both of which a comparison tool is under
 * constant pressure to do anyway.
 *
 * It does not declare a winner. Cost and recovery compare cleanly across these
 * rows; likelihood of benefit does not, because a joint replacement has national
 * registry data behind it and most regenerative protocols have observational
 * series. A star rating spanning both would invent a comparison nobody can make,
 * so the evidence column is a sentence and the reader draws the conclusion.
 *
 * And it does not price its rows from the directory. Clinic price fields are a
 * whole-clinic range, so using them per procedure produced a PRP row several
 * times the real figure; see the header of `lib/tools/comparison.ts`. Every
 * number here is an indicative self-pay range carrying the date it was last
 * reviewed, and the page sends anybody who wants directory pricing to the cost
 * calculator, where a clinic-level band is the right answer to the question.
 */
export function TreatmentComparison() {
  const [focusKey, setFocusKey] = React.useState<string>(
    COMPARISON_FOCUSES[0]!.key,
  );

  const focus = focusByKey(focusKey)!;
  const rows = React.useMemo(() => comparisonRows(focusKey), [focusKey]);
  const spread = comparisonSpread(rows);
  const money = (v: number) => formatPrice(v, { currency: DEFAULT_CURRENCY });

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-4">
        <Segmented
          label="What are you weighing up?"
          options={COMPARISON_FOCUSES.map((f) => ({
            value: f.key,
            label: f.short,
          }))}
          value={focusKey}
          onChange={setFocusKey}
        />
        <p className="text-[13px] leading-relaxed text-text-secondary">
          {focus.intro}
        </p>
        {spread ? (
          <p className="text-[13px] leading-relaxed text-text-secondary">
            For {focus.label.toLowerCase()} the options below run from{" "}
            <strong className="font-semibold text-text-primary">
              {money(spread.cheapest.costLow)}
            </strong>{" "}
            at the bottom of {spread.cheapest.label.toLowerCase()} to{" "}
            <strong className="font-semibold text-text-primary">
              {money(spread.dearest.costHigh)}
            </strong>{" "}
            at the top of {spread.dearest.label.toLowerCase()}.
          </p>
        ) : null}
      </ToolPanel>

      <ResultPanel>
        {/* Wide table on desktop. The wrapper scrolls rather than the page. */}
        <div className="-mx-4 hidden overflow-x-auto px-4 md:-mx-5 md:block md:px-5">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[190px]">Option</TableHead>
                <TableHead className="w-[165px]">Approximate cost</TableHead>
                <TableHead className="w-[140px]">Recovery</TableHead>
                <TableHead className="w-[150px]">How long it lasts</TableHead>
                <TableHead>State of the evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="align-top">
                    <span className="block font-semibold text-text-primary">
                      {row.label}
                    </span>
                    <span className="mt-1 block">
                      <KindPill kind={row.kind} />
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="block font-semibold text-text-primary">
                      {money(row.costLow)} to {money(row.costHigh)}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-text-muted">
                      {row.costBasis}
                    </span>
                    <span className="mt-1 block text-[11.5px] font-medium text-text-muted">
                      Indicative, {REFERENCE_AS_OF}
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-text-secondary">
                    {row.recovery}
                    <span className="mt-0.5 block text-[12px] text-text-muted">
                      {row.course}
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-text-secondary">
                    {row.durability}
                    <span className="mt-0.5 block text-[12px] text-text-muted">
                      {row.insurance}
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-[13px] leading-relaxed text-text-secondary">
                    {row.evidence}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Stacked on narrow screens: a five-column table at 380px is unreadable
            however it scrolls, so the same rows are re-laid out rather than
            squeezed. */}
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <article
              key={row.key}
              className="rounded-lg border border-border bg-surface p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
                  {row.label}
                </h3>
                <KindPill kind={row.kind} />
              </div>
              <p className="mt-1.5 font-display text-[17px] font-semibold text-text-primary">
                {money(row.costLow)} to {money(row.costHigh)}
              </p>
              <p className="text-[12px] text-text-muted">
                {row.costBasis}. Indicative, {REFERENCE_AS_OF}.
              </p>
              <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
                {MOBILE_FIELDS.map((field) => (
                  <div key={field.key} className="flex gap-2">
                    <dt className="w-[92px] shrink-0 text-[12px] font-medium text-text-muted">
                      {field.label}
                    </dt>
                    <dd className="min-w-0 flex-1 text-[13px] leading-relaxed text-text-secondary">
                      {String(row[field.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>

        <ToolNote>
          Every figure here is a broad United States self-pay range last reviewed
          in {REFERENCE_AS_OF}, offered as an order of magnitude rather than a
          quote. These are list prices: what an insured patient actually pays
          bears little relationship to them, and the same procedure varies
          several fold between facilities in the same city. For prices published
          by clinics listed on this site, use the cost calculator, which shows
          how many clinics are behind every band.
        </ToolNote>

        <ToolNote tone="warning">
          Cost and recovery compare across these rows. Likelihood of benefit does
          not, which is why there is no score and no recommended option. Joint
          replacement is backed by decades of registry outcomes; most
          regenerative protocols are not approved for these conditions and rest
          on far thinner evidence. Any decision here belongs with a clinician who
          has examined you and seen your imaging.
        </ToolNote>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {focus.conditionSlug ? (
            <Button asChild>
              <Link href={`/conditions/${focus.conditionSlug}`}>
                Read about {focus.label.toLowerCase()}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href="/tools/stem-cell-cost-calculator">
              Price a course from clinic listings
            </Link>
          </Button>
        </div>
      </ResultPanel>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  AnsweredMeter,
  LikertRow,
  LikertScaleKey,
  ResultHeadline,
  ResultPanel,
  ResultStat,
  ResultStats,
  ScaleBar,
  ToolNote,
  ToolPanel,
} from "@/components/tools/tool-ui";
import { scoreQuestionnaire } from "@/lib/tools/calc";
import {
  HIP_QUESTIONNAIRE,
  KNEE_QUESTIONNAIRE,
  domainsFor,
  itemIdsFor,
  type QuestionnaireDef,
} from "@/lib/tools/questionnaires";

/** Which joint the page is scoring. */
export type Joint = "knee" | "hip";

/**
 * The two joints, and the small amount that differs between them.
 *
 * A `joint` string rather than a `def` prop because these are client
 * components: passing the whole questionnaire from the server would put all
 * twenty-odd items into the RSC payload as well as into the bundle they are
 * already in.
 */
const JOINTS: Record<
  Joint,
  {
    def: QuestionnaireDef;
    /** Directory condition slug the result links through to. */
    conditionSlug: string;
    conditionLabel: string;
  }
> = {
  knee: {
    def: KNEE_QUESTIONNAIRE,
    conditionSlug: "knee-osteoarthritis",
    conditionLabel: "knee osteoarthritis",
  },
  hip: {
    def: HIP_QUESTIONNAIRE,
    conditionSlug: "hip-osteoarthritis",
    conditionLabel: "hip osteoarthritis",
  },
};

/**
 * The shared symptom questionnaire, scoring pain, stiffness and daily function.
 *
 * The result panel is rendered from the first answer rather than after the last,
 * with an explicit "partial" state. Twenty-odd questions is a long way to go
 * with nothing happening, and a partial score is genuinely informative as long
 * as the page says it is partial. `scoreQuestionnaire` excludes unanswered items
 * from the denominator, so a half-filled form does not read as a healthy joint.
 *
 * The result links to the directory and to the condition page, and it does not
 * suggest a treatment. A symptom score says how much a joint is interfering with
 * a normal day. It does not say what to do about it, and a tool that answered a
 * high score with "you may be a candidate for stem cell therapy" would be
 * inventing a clinical judgement it has no basis for.
 */
export function JointScoreCalculator({ joint }: { joint: Joint }) {
  const { def, conditionSlug, conditionLabel } = JOINTS[joint];
  const domains = React.useMemo(() => domainsFor(def), [def]);
  const itemIds = React.useMemo(() => itemIdsFor(def), [def]);

  const [answers, setAnswers] = React.useState<
    Record<string, number | undefined>
  >({});

  const result = scoreQuestionnaire({
    domains,
    answers,
    maxPerItem: def.scale.length - 1,
    bands: def.bands,
  });

  const complete = result.answered === itemIds.length;
  const started = result.answered > 0;

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-text-secondary">
            Rate the last 48 hours. 0 is none, 4 is extreme.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAnswers({})}
            disabled={!started}
          >
            Clear answers
          </Button>
        </div>

        <AnsweredMeter answered={result.answered} total={itemIds.length} />

        {def.domains.map((domain) => (
          <section key={domain.key}>
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
              {domain.label}
            </h3>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              {domain.prompt}
            </p>
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <LikertScaleKey scale={def.scale} />
              {domain.items.map((item, i) => (
                <LikertRow
                  key={item.id}
                  index={i}
                  itemLabel={item.label}
                  scale={def.scale}
                  value={answers[item.id]}
                  onChange={(value) =>
                    setAnswers((prev) => ({ ...prev, [item.id]: value }))
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </ToolPanel>

      {started ? (
        <ResultPanel>
          <ResultHeadline
            label={complete ? "Your score" : "Score so far"}
            value={result.score.toFixed(0)}
            unit="/ 100"
            sub={
              <>
                <strong className="font-semibold text-text-primary">
                  {result.band.label}.
                </strong>{" "}
                {result.band.summary}
              </>
            }
          />

          <ScaleBar
            segments={def.bands.map((b) => ({
              label: b.label,
              min: b.min,
              max: b.max,
            }))}
            value={result.score}
            axisMin={0}
            axisMax={100}
            activeLabel={result.band.label}
          />

          <ResultStats cols={3}>
            {result.domains.map((d) => (
              <ResultStat
                key={d.key}
                label={d.label}
                value={`${d.score.toFixed(0)} / 100`}
              />
            ))}
          </ResultStats>

          {complete ? (
            <ToolNote>
              Note the score and today&apos;s date. Repeated in three and six
              months, the change is worth far more than the number on its own,
              because symptom recall over months is poor and a dated pair of
              scores is not.
            </ToolNote>
          ) : (
            <ToolNote tone="warning">
              {result.answered} of {itemIds.length} answered. This is scored
              only on what you have filled in, so it will move as you complete
              the rest.
            </ToolNote>
          )}

          {complete ? (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="secondary">
                <Link href={`/conditions/${conditionSlug}`}>
                  Read about {conditionLabel}
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/tools/treatment-comparison">
                  Compare the treatment options
                </Link>
              </Button>
            </div>
          ) : null}
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Answer any item to start scoring. Higher scores mean more symptoms.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}

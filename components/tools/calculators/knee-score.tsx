"use client";

import * as React from "react";

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
  KNEE_QUESTIONNAIRE,
  domainsFor,
  itemIdsFor,
} from "@/lib/tools/questionnaires";

const DEF = KNEE_QUESTIONNAIRE;
const DOMAINS = domainsFor(DEF);
const ITEM_IDS = itemIdsFor(DEF);

/**
 * Twenty-four items across pain, stiffness and function.
 *
 * The result panel is rendered from the first answer rather than after the last,
 * with an explicit "partial" state. Twenty-four questions is a long way to go
 * with nothing happening, and a partial score is genuinely informative as long
 * as the page says it is partial. `scoreQuestionnaire` excludes unanswered items
 * from the denominator, so a half-filled form does not read as a healthy knee.
 */
export function KneeScoreCalculator() {
  const [answers, setAnswers] = React.useState<Record<string, number | undefined>>(
    {},
  );

  const result = scoreQuestionnaire({
    domains: DOMAINS,
    answers,
    maxPerItem: DEF.scale.length - 1,
    bands: DEF.bands,
  });

  const complete = result.answered === ITEM_IDS.length;
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

        <AnsweredMeter answered={result.answered} total={ITEM_IDS.length} />

        {DEF.domains.map((domain) => (
          <section key={domain.key}>
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
              {domain.label}
            </h3>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              {domain.prompt}
            </p>
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <LikertScaleKey scale={DEF.scale} />
              {domain.items.map((item, i) => (
                <LikertRow
                  key={item.id}
                  index={i}
                  itemLabel={item.label}
                  scale={DEF.scale}
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
            segments={DEF.bands.map((b) => ({
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
              months,
              the change is worth far more than the number on its own, because
              symptom recall over months is poor and a dated pair of scores is
              not.
            </ToolNote>
          ) : (
            <ToolNote tone="warning">
              {result.answered} of {ITEM_IDS.length} answered. This is scored
              only on what you have filled in, so it will move as you complete
              the rest.
            </ToolNote>
          )}
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

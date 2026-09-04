"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AnsweredMeter,
  ChoiceList,
  ResultHeadline,
  ResultPanel,
  ScaleBar,
  ToolNote,
  ToolPanel,
} from "@/components/tools/tool-ui";
import { scoreQuestionnaire } from "@/lib/tools/calc";
import {
  BACK_QUESTIONNAIRE,
  BACK_SECTIONS,
  domainsFor,
} from "@/lib/tools/questionnaires";

const DEF = BACK_QUESTIONNAIRE;
const DOMAINS = domainsFor(DEF);
const MAX_PER_SECTION = 5;

/**
 * Ten sections, six statements each, scored as a percentage.
 *
 * The red-flag panel sits above the questionnaire rather than below the result,
 * which is the one piece of layout here that is not a style choice. Cauda equina
 * symptoms are a same-day emergency, and somebody with them should be reading
 * that before they spend four minutes rating how far they can walk, not after.
 */
export function BackScoreCalculator() {
  const [answers, setAnswers] = React.useState<
    Record<string, number | undefined>
  >({});

  const result = scoreQuestionnaire({
    domains: DOMAINS,
    answers,
    maxPerItem: MAX_PER_SECTION,
    bands: DEF.bands,
  });

  const complete = result.answered === BACK_SECTIONS.length;
  const started = result.answered > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-danger"
          aria-hidden="true"
        />
        <p className="text-[12.5px] leading-relaxed text-danger-fg">
          <strong className="font-semibold">Seek care today</strong> if you have
          lost bladder or bowel control, have numbness around the groin or inner
          thighs, have progressive weakness in a leg, or the pain followed a
          significant injury. Those symptoms need urgent assessment, not a
          questionnaire.
        </p>
      </div>

      <ToolPanel className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-text-secondary">
            Pick the statement that best describes you today.
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

        <AnsweredMeter
          answered={result.answered}
          total={BACK_SECTIONS.length}
        />

        <div className="space-y-6">
          {BACK_SECTIONS.map((section, i) => (
            <ChoiceList<string>
              key={section.id}
              label={`${i + 1}. ${section.label}`}
              value={
                answers[section.id] === undefined
                  ? undefined
                  : String(answers[section.id])
              }
              onChange={(value) =>
                setAnswers((prev) => ({ ...prev, [section.id]: Number(value) }))
              }
              options={section.options.map((option, index) => ({
                value: String(index),
                label: option,
              }))}
            />
          ))}
        </div>
      </ToolPanel>

      {started ? (
        <ResultPanel>
          <ResultHeadline
            label={complete ? "Disability score" : "Score so far"}
            value={result.score.toFixed(0)}
            unit="%"
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

          {complete ? (
            <ToolNote>
              You scored {result.raw} of a possible {result.rawMax} points. Note
              the figure and the date, then repeat it after any change in
              treatment. A dated pair of scores is the most useful thing you can
              bring to a follow-up appointment.
            </ToolNote>
          ) : (
            <ToolNote tone="warning">
              {result.answered} of {BACK_SECTIONS.length} sections answered.
              Scored on those alone, so it will move as you finish the rest.
            </ToolNote>
          )}
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Answer any section to start scoring. Higher percentages mean more
            limitation.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}

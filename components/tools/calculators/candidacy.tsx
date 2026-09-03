"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AnsweredMeter,
  ChoiceList,
  ResultHeadline,
  ResultPanel,
  ToolNote,
  ToolPanel,
} from "@/components/tools/tool-ui";
import { CANDIDACY_QUESTIONS } from "@/lib/tools/candidacy";
import { scoreCandidacy } from "@/lib/tools/cost";

/**
 * The candidacy screen.
 *
 * Blockers are rendered above the score, not beside it, and the score is
 * suppressed entirely when one is present. Showing "72 out of 100, but you have
 * active cancer" invites exactly the reading the model is built to prevent: that
 * a good profile can outweigh a contraindication.
 */
export function CandidacyCalculator() {
  const [answers, setAnswers] = React.useState<Record<string, string | undefined>>(
    {},
  );

  const result = scoreCandidacy(CANDIDACY_QUESTIONS, answers);
  const started = result.answered > 0;
  const complete = result.answered === CANDIDACY_QUESTIONS.length;
  const blocked = result.blockers.length > 0;

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-text-secondary">
            Twelve questions. Nothing is sent anywhere.
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
          total={CANDIDACY_QUESTIONS.length}
        />

        <div className="space-y-6">
          {CANDIDACY_QUESTIONS.map((q, i) => (
            <ChoiceList<string>
              key={q.id}
              label={`${i + 1}. ${q.question}`}
              hint={q.hint}
              value={answers[q.id]}
              onChange={(value) =>
                setAnswers((prev) => ({ ...prev, [q.id]: value }))
              }
              options={q.answers.map((a) => ({
                value: a.value,
                label: a.label,
              }))}
            />
          ))}
        </div>
      </ToolPanel>

      {started ? (
        <ResultPanel>
          {blocked ? (
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-danger">
                Not right now
              </p>
              <p className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[28px]">
                Speak to your own doctor before approaching a clinic
              </p>
              <ul className="mt-3 space-y-2">
                {result.blockers.map((b) => (
                  <li
                    key={b.question}
                    className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5"
                  >
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-danger"
                      aria-hidden="true"
                    />
                    <span className="text-[13px] leading-relaxed text-danger-fg">
                      {b.note}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">
                {result.summary}
              </p>
            </div>
          ) : (
            <ResultHeadline
              label={complete ? "Your result" : "Result so far"}
              value={result.label}
              sub={result.summary}
            />
          )}

          {!blocked && result.strengths.length ? (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-text-primary">
                Working in your favour
              </h3>
              <ul className="mt-2 space-y-1.5">
                {result.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span className="text-[13px] leading-relaxed text-text-secondary">
                      {s}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.flags.length ? (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-text-primary">
                Raise these at a consultation
              </h3>
              <ul className="mt-2 space-y-1.5">
                {result.flags.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Info
                      className="mt-0.5 size-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <span className="text-[13px] leading-relaxed text-text-secondary">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!complete ? (
            <ToolNote tone="warning">
              {result.answered} of {CANDIDACY_QUESTIONS.length} answered. The
              read will firm up as you finish.
            </ToolNote>
          ) : null}

          {!blocked && complete ? (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/find-a-clinic">Find a matching clinic</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/methodology">How clinics here are checked</Link>
              </Button>
            </div>
          ) : null}
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Answer any question to start. The result is a read on fit, not a
            diagnosis and not a prediction that treatment will work.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}

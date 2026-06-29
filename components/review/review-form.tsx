"use client";

/**
 * ReviewForm — multi-step review submission (Stage 5.5 / PRD §6.4). Steps:
 * (1) treatment context, (2) ratings, (3) story, (4) cost, (5) identity +
 * consent. POSTs to `/api/reviews`; the review is created `pending` and
 * email-unverified, then a confirmation email is sent — it never auto-publishes.
 * Email + consent + 18+ are required (PRD §14, §8.6).
 */
import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TextField, TextareaField, SelectField } from "@/components/ui/form-field";
import { StarRatingInput } from "@/components/ui/star-rating-input";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { SUB_RATING_LABELS } from "@/components/ui/rating-stars";
import type { SubRatingKey } from "@/lib/enums";

interface Option {
  id: string;
  name: string;
}

export interface ReviewFormProps {
  clinicId: string;
  clinicName: string;
  treatments: Option[];
  conditions: Option[];
}

const SUB_KEYS: SubRatingKey[] = [
  "outcome",
  "communication",
  "facility",
  "value",
  "refer",
];

const STEPS = ["Treatment", "Ratings", "Your story", "Cost", "About you"];

export function ReviewForm({
  clinicId,
  clinicName,
  treatments,
  conditions,
}: ReviewFormProps) {
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  // Field state.
  const [treatmentId, setTreatmentId] = React.useState("");
  const [conditionId, setConditionId] = React.useState("");
  const [treatmentDate, setTreatmentDate] = React.useState("");
  const [overall, setOverall] = React.useState(0);
  const [subRatings, setSubRatings] = React.useState<Record<SubRatingKey, number>>({
    outcome: 0,
    communication: 0,
    facility: 0,
    value: 0,
    refer: 0,
  });
  const [headline, setHeadline] = React.useState("");
  const [body, setBody] = React.useState({
    condition: "",
    whyChosen: "",
    treatmentDescription: "",
    outcome: "",
    experience: "",
    improvement: "",
  });
  const [costRange, setCostRange] = React.useState("");
  const [costConfidential, setCostConfidential] = React.useState(false);
  const [displayName, setDisplayName] = React.useState("");
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [country, setCountry] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [age, setAge] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function next() {
    setError(null);
    if (step === 1 && overall < 1) {
      setError("Please give an overall rating.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setError(null);
    if (overall < 1) {
      setStep(1);
      setError("Please give an overall rating.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address so we can verify your review.");
      return;
    }
    if (!consent || !age) {
      setError("Please confirm you're 18+ and agree to the terms.");
      return;
    }

    setSubmitting(true);
    const ratings = Object.fromEntries(
      SUB_KEYS.filter((k) => subRatings[k] > 0).map((k) => [k, subRatings[k]]),
    );
    const cleanBody = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v.trim()),
    );

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        treatmentId: treatmentId || undefined,
        conditionId: conditionId || undefined,
        treatmentDate: treatmentDate || undefined,
        ratingOverall: overall,
        ratings,
        headline: headline || undefined,
        body: cleanBody,
        cost:
          costRange || costConfidential
            ? { range: costRange || undefined, isConfidential: costConfidential }
            : undefined,
        reviewer: {
          displayName: isAnonymous ? undefined : displayName || undefined,
          isAnonymous,
          email,
          country: country || undefined,
        },
        consentGiven: true,
        ageConfirmed: true,
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      setSentTo(email);
      return;
    }
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setError(data?.error ?? "Something went wrong. Please try again.");
    toast.error(data?.error ?? "Something went wrong. Please try again.");
  }

  if (sentTo) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
        <span className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl font-bold text-text-primary">
          Confirm your email
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to
          send your review to our moderation team — reviews are checked before
          they go live, and we never publish your email.
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/clinics">Browse more clinics</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card md:p-8">
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-[12.5px]">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                i === step
                  ? "inline-flex items-center gap-1.5 rounded-full bg-tint px-2.5 py-1 font-semibold text-azure-700"
                  : i < step
                    ? "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-text-secondary"
                    : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-text-muted"
              }
            >
              <span
                className={
                  i <= step
                    ? "flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white"
                    : "flex size-5 items-center justify-center rounded-full border border-border-strong text-[11px] text-text-muted"
                }
              >
                {i + 1}
              </span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {/* Step 1 — treatment context */}
      {step === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            You&apos;re reviewing <strong>{clinicName}</strong>.
          </p>
          {treatments.length ? (
            <SelectField
              label="Treatment received"
              placeholder="Select a treatment (optional)"
              options={treatments.map((t) => ({ value: t.id, label: t.name }))}
              value={treatmentId || undefined}
              onValueChange={setTreatmentId}
            />
          ) : null}
          {conditions.length ? (
            <SelectField
              label="Condition treated"
              placeholder="Select a condition (optional)"
              options={conditions.map((c) => ({ value: c.id, label: c.name }))}
              value={conditionId || undefined}
              onValueChange={setConditionId}
            />
          ) : null}
          <TextField
            label="When was your treatment?"
            placeholder="e.g. March 2024"
            value={treatmentDate}
            onChange={(e) => setTreatmentDate(e.target.value)}
          />
        </div>
      ) : null}

      {/* Step 2 — ratings */}
      {step === 1 ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface-alt p-4">
            <StarRatingInput
              label="Overall rating"
              value={overall}
              onChange={setOverall}
              size={28}
            />
          </div>
          <div className="space-y-3">
            {SUB_KEYS.map((key) => (
              <StarRatingInput
                key={key}
                label={SUB_RATING_LABELS[key]}
                value={subRatings[key]}
                onChange={(v) =>
                  setSubRatings((prev) => ({ ...prev, [key]: v }))
                }
                size={20}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 3 — story */}
      {step === 2 ? (
        <div className="space-y-4">
          <TextField
            label="Headline"
            placeholder="Sum up your experience in a sentence"
            maxLength={160}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <TextareaField
            label="Background"
            placeholder="What was your condition or goal?"
            rows={2}
            value={body.condition}
            onChange={(e) => setBody((b) => ({ ...b, condition: e.target.value }))}
          />
          <TextareaField
            label="Why you chose this clinic"
            rows={2}
            value={body.whyChosen}
            onChange={(e) => setBody((b) => ({ ...b, whyChosen: e.target.value }))}
          />
          <TextareaField
            label="Treatment received"
            rows={2}
            value={body.treatmentDescription}
            onChange={(e) =>
              setBody((b) => ({ ...b, treatmentDescription: e.target.value }))
            }
          />
          <TextareaField
            label="Outcome"
            placeholder="How do you feel now? Individual results vary."
            rows={2}
            value={body.outcome}
            onChange={(e) => setBody((b) => ({ ...b, outcome: e.target.value }))}
          />
          <TextareaField
            label="What could have been better"
            rows={2}
            value={body.improvement}
            onChange={(e) => setBody((b) => ({ ...b, improvement: e.target.value }))}
          />
        </div>
      ) : null}

      {/* Step 4 — cost */}
      {step === 3 ? (
        <div className="space-y-4">
          <TextField
            label="Approximate cost"
            placeholder="e.g. $8,000–$10,000"
            value={costRange}
            onChange={(e) => setCostRange(e.target.value)}
            disabled={costConfidential}
          />
          <label className="flex items-center gap-2.5 text-[13.5px] text-text-secondary">
            <input
              type="checkbox"
              className="size-4 rounded border-border-strong accent-primary"
              checked={costConfidential}
              onChange={(e) => setCostConfidential(e.target.checked)}
            />
            Keep my cost confidential
          </label>
        </div>
      ) : null}

      {/* Step 5 — identity + consent */}
      {step === 4 ? (
        <div className="space-y-4">
          <label className="flex items-center gap-2.5 text-[13.5px] text-text-secondary">
            <input
              type="checkbox"
              className="size-4 rounded border-border-strong accent-primary"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Post anonymously (shown as &ldquo;Verified Patient&rdquo;)
          </label>
          {!isAnonymous ? (
            <TextField
              label="Display name"
              placeholder="e.g. James T."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          ) : null}
          <TextField
            label="Country"
            placeholder="Where you're based (optional)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            required
            hint="Private — used to verify your review. Never shown publicly."
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="flex items-start gap-2.5 text-[12.5px] text-text-secondary">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary"
              checked={age}
              onChange={(e) => setAge(e.target.checked)}
            />
            I&apos;m 18 or older and this review reflects my own experience.
          </label>
          <label className="flex items-start gap-2.5 text-[12.5px] text-text-secondary">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-medium text-text-link hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-text-link hover:underline">
                privacy policy
              </Link>
              , and understand this is informational, not medical advice.
            </span>
          </label>
          <DisclaimerNote variant="results" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={back}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit review"}
          </Button>
        )}
      </div>
    </div>
  );
}

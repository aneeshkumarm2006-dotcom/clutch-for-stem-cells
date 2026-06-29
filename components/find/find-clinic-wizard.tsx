"use client";

/**
 * FindClinicWizard — guided matching stepper (Stage 5.6 / PRD §6.5). Collects
 * condition → treatment interest → location → budget → timeframe → contact, then
 * creates a `Lead(type='match')` and routes the user to the directory pre-filtered
 * to their matching shortlist (filter + ranking). Consent + 18 gate per §14/§8.6.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/form-field";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";

export interface WizardOption {
  id: string;
  slug: string;
  name: string;
}

export interface FindClinicWizardProps {
  conditions: WizardOption[];
  treatments: WizardOption[];
  countries: { name: string; slug: string }[];
}

const BUDGETS = [
  { value: "under-5000", label: "Under $5,000", priceMax: 5000 },
  { value: "5000-10000", label: "$5,000 – $10,000", priceMax: 10000 },
  { value: "10000-20000", label: "$10,000 – $20,000", priceMax: 20000 },
  { value: "20000-plus", label: "$20,000+", priceMax: undefined },
  { value: "flexible", label: "Flexible / not sure", priceMax: undefined },
];

const TIMEFRAMES = [
  { value: "asap", label: "As soon as possible" },
  { value: "1-3mo", label: "Within 1–3 months" },
  { value: "3-6mo", label: "Within 3–6 months" },
  { value: "researching", label: "Just researching" },
];

const STEPS = ["Condition", "Treatment", "Location", "Budget", "Timeframe", "Contact"];

export function FindClinicWizard({
  conditions,
  treatments,
  countries,
}: FindClinicWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [conditionId, setConditionId] = React.useState<string>("");
  const [treatmentIds, setTreatmentIds] = React.useState<string[]>([]);
  const [countryName, setCountryName] = React.useState<string>("");
  const [budget, setBudget] = React.useState<string>("");
  const [timeframe, setTimeframe] = React.useState<string>("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [agree, setAgree] = React.useState(false);

  const condition = conditions.find((c) => c.id === conditionId);
  const toggleTreatment = (id: string) =>
    setTreatmentIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  function buildDirectoryHref(): string {
    const sp = new URLSearchParams();
    if (condition) sp.set("condition", condition.slug);
    const tSlugs = treatments
      .filter((t) => treatmentIds.includes(t.id))
      .map((t) => t.slug);
    if (tSlugs.length) sp.set("treatment", tSlugs.join(","));
    if (countryName) sp.set("country", countryName);
    const b = BUDGETS.find((x) => x.value === budget);
    if (b?.priceMax) sp.set("priceMax", String(b.priceMax));
    const qs = sp.toString();
    return qs ? `/clinics?${qs}` : "/clinics";
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Please add your name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!agree) {
      setError("Please confirm you're 18+ and agree to the terms.");
      return;
    }

    setSubmitting(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "match",
          name,
          email,
          country: countryName || undefined,
          conditionId: conditionId || undefined,
          treatmentInterest: treatmentIds,
          budgetRange: BUDGETS.find((b) => b.value === budget)?.label,
          timeframe: timeframe || undefined,
          consentGiven: true,
          ageConfirmed: true,
          source: "find-a-clinic",
        }),
      });
    } catch {
      /* matching still proceeds — the lead is best-effort */
    }
    toast.success("Here are clinics that match your answers");
    router.push(buildDirectoryHref());
  }

  const canContinue =
    (step === 0 && conditionId) ||
    (step === 1) ||
    (step === 2) ||
    (step === 3 && budget) ||
    (step === 4 && timeframe) ||
    step === 5;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card md:p-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-[12.5px] text-text-muted">
          <span className="font-semibold text-text-secondary">
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 ? (
        <Fieldset
          title="What condition are you researching?"
          help="Pick the closest match — you can refine results later."
        >
          <div className="flex flex-wrap gap-2">
            {conditions.map((c) => (
              <Chip
                key={c.id}
                selected={conditionId === c.id}
                onClick={() => setConditionId(conditionId === c.id ? "" : c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </Fieldset>
      ) : null}

      {step === 1 ? (
        <Fieldset
          title="Which treatments interest you?"
          help="Optional — select any that apply."
        >
          <div className="flex flex-wrap gap-2">
            {treatments.map((t) => (
              <Chip
                key={t.id}
                selected={treatmentIds.includes(t.id)}
                onClick={() => toggleTreatment(t.id)}
              >
                {treatmentIds.includes(t.id) ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : null}
                {t.name}
              </Chip>
            ))}
          </div>
        </Fieldset>
      ) : null}

      {step === 2 ? (
        <Fieldset
          title="Any location preference?"
          help="Optional — leave blank to see clinics worldwide."
        >
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <Chip
                key={c.slug}
                selected={countryName === c.name}
                onClick={() =>
                  setCountryName(countryName === c.name ? "" : c.name)
                }
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </Fieldset>
      ) : null}

      {step === 3 ? (
        <Fieldset title="What's your budget?" help="A rough range is fine.">
          <div className="grid gap-2 sm:grid-cols-2">
            {BUDGETS.map((b) => (
              <RadioCard
                key={b.value}
                checked={budget === b.value}
                onClick={() => setBudget(b.value)}
                label={b.label}
              />
            ))}
          </div>
        </Fieldset>
      ) : null}

      {step === 4 ? (
        <Fieldset title="When are you hoping to start?">
          <div className="grid gap-2 sm:grid-cols-2">
            {TIMEFRAMES.map((t) => (
              <RadioCard
                key={t.value}
                checked={timeframe === t.value}
                onClick={() => setTimeframe(t.value)}
                label={t.label}
              />
            ))}
          </div>
        </Fieldset>
      ) : null}

      {step === 5 ? (
        <Fieldset
          title="Where should we send your matches?"
          help="We'll show your matches now and share your request with suitable clinics."
        >
          <div className="space-y-4">
            <TextField
              label="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
            <label className="flex items-start gap-2.5 text-[12.5px] text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I&apos;m 18 or older and agree to the{" "}
                <Link href="/terms" className="font-medium text-text-link hover:underline">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-text-link hover:underline">
                  privacy policy
                </Link>
                . I understand this is informational and not medical advice.
              </span>
            </label>
            <DisclaimerNote variant="medical" />
          </div>
        </Fieldset>
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
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => {
              setError(null);
              if (!canContinue) {
                setError("Please make a selection to continue.");
                return;
              }
              setStep((s) => s + 1);
            }}
          >
            Continue
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Finding matches…" : "See my matches"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Fieldset({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-text-primary">
        {title}
      </h2>
      {help ? (
        <p className="mt-1 text-[13.5px] text-text-secondary">{help}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RadioCard({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-[14px] transition-colors",
        checked
          ? "border-azure-300 bg-tint text-azure-700"
          : "border-border bg-surface text-text-secondary hover:border-border-strong",
      )}
    >
      {label}
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full border",
          checked ? "border-primary bg-primary" : "border-border-strong",
        )}
      >
        {checked ? <Check className="size-2.5 text-white" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

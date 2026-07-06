"use client";

/**
 * First-run wizard: create password → confirm project identity → connect
 * sources (all skippable) → land on Overview. The setup POST sets the session
 * cookie, so the connection cards work in the final step.
 */
import { useState } from "react";

import { ApiError, apiPost } from "@/components/analyticshub/api";
import { ColorField, ConnectionCards } from "@/components/analyticshub/connections";
import { useHub } from "@/components/analyticshub/context";
import {
  CenteredShell,
  btnGhost,
  btnPrimary,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/analyticshub/shell-ui";
import { cn } from "@/lib/utils";

type Step = "password" | "project" | "connect";
const STEPS: { id: Step; label: string }[] = [
  { id: "password", label: "Password" },
  { id: "project", label: "Project" },
  { id: "connect", label: "Connect" },
];

function Steps({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="mb-4 flex items-center gap-2 text-xs">
      {STEPS.map((s, i) => (
        <span key={s.id} className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold",
              i <= idx
                ? "bg-primary text-primary-foreground"
                : "bg-surface-alt text-text-muted",
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn(
              i === idx ? "font-medium text-text-primary" : "text-text-muted",
            )}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="text-text-muted">·</span>}
        </span>
      ))}
    </div>
  );
}

export function Wizard() {
  const { status, reloadStatus, setScreen } = useHub();
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState(status?.project.name ?? "StemConnect");
  const [primary, setPrimary] = useState(status?.project.primary ?? "#0e80cc");
  const [accent, setAccent] = useState(status?.project.accent ?? "#e2f0fb");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function nextFromPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setStep("project");
  }

  async function createDashboard() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("setup", {
        password,
        project: { name, primary, accent },
      });
      await reloadStatus();
      setStep("connect");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await reloadStatus();
    setScreen("app");
  }

  const project = { name, primary, accent };

  if (step === "connect") {
    return (
      <CenteredShell project={project} wide>
        <div className="mb-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <Steps current={step} />
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Connect your data
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Connect any sources now, or skip and add them later in Settings.
          </p>
        </div>
        <ConnectionCards />
        <div className="mt-4 flex justify-end">
          <button onClick={finish} className={btnPrimary}>
            Go to dashboard →
          </button>
        </div>
      </CenteredShell>
    );
  }

  return (
    <CenteredShell project={project}>
      <div className={cardClass}>
        <Steps current={step} />
        {step === "password" ? (
          <form onSubmit={nextFromPassword}>
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Create a password
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              This is the only credential for the dashboard.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-fg">
              There is no password reset. Store this somewhere safe.
            </p>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <button type="submit" className={`mt-4 w-full ${btnPrimary}`}>
              Continue
            </button>
          </form>
        ) : (
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Confirm your project
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              We detected these — edit if you like.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Project name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ColorField label="Primary" value={primary} onChange={setPrimary} />
                <ColorField label="Accent" value={accent} onChange={setAccent} />
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep("password")}
                className={btnGhost}
                type="button"
              >
                Back
              </button>
              <button
                onClick={createDashboard}
                disabled={busy}
                className={`flex-1 ${btnPrimary}`}
              >
                {busy ? "Creating…" : "Create dashboard"}
              </button>
            </div>
          </div>
        )}
      </div>
    </CenteredShell>
  );
}

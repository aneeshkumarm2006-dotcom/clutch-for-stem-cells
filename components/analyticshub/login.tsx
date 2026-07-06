"use client";

import { useState } from "react";

import { ApiError, apiPost } from "@/components/analyticshub/api";
import { useHub } from "@/components/analyticshub/context";
import {
  CenteredShell,
  btnPrimary,
  cardClass,
  inputClass,
} from "@/components/analyticshub/shell-ui";

export function Login() {
  const { status, reloadStatus, setScreen } = useHub();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("login", { password });
      await reloadStatus();
      setScreen("app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <CenteredShell project={status?.project ?? undefined}>
      <form onSubmit={submit} className={cardClass}>
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Sign in
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Enter the dashboard password.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          className={`mt-4 ${inputClass}`}
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className={`mt-4 w-full ${btnPrimary}`}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </CenteredShell>
  );
}

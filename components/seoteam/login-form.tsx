"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { adminFetch } from "@/lib/admin/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/seoteam") ? next : "/seoteam";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter the dashboard password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/api/seoteam/login", {
        method: "POST",
        body: { password },
      });
      toast.success("Signed in");
      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField
        label="Dashboard password"
        type="password"
        leadingIcon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        autoComplete="current-password"
        autoFocus
        placeholder="Enter password"
      />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

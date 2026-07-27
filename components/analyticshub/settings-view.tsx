"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  ConnectionCards,
  PasswordCard,
  ProjectCard,
} from "@/components/analyticshub/connections";

/** Reads the ?google= result the OAuth callback redirects back with. */
function googleToast() {
  const g = new URLSearchParams(window.location.search).get("google");
  if (!g) return;
  if (g === "connected") toast.success("Google connected. Pick a property and site.");
  else if (g === "denied") toast.error("Google authorization was cancelled.");
  else if (g === "badstate") toast.error("Google sign-in expired. Try again.");
  else if (g === "session") toast.error("Session expired. Sign in and retry.");
  else if (g === "unavailable")
    toast.error("Google sign-in isn't configured on this deployment.");
  else if (g === "error")
    toast.error(
      new URLSearchParams(window.location.search).get("msg") ??
        "Google connection failed.",
    );
  // Clean the query so a refresh doesn't re-toast.
  window.history.replaceState({}, "", "/analyticshub/settings");
}

export function SettingsView() {
  useEffect(() => {
    googleToast();
  }, []);

  return (
    <div className="space-y-4">
      <ProjectCard />
      <ConnectionCards />
      <PasswordCard />
    </div>
  );
}

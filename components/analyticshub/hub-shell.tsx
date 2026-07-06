"use client";

/**
 * The client shell: provides the hub context and gates between the loader,
 * config-error, first-run wizard, login, and the full app chrome. Lives in the
 * layout so it stays mounted across sidebar navigation (context persists).
 */
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { HubProvider, useHub } from "@/components/analyticshub/context";
import { Login } from "@/components/analyticshub/login";
import {
  CenteredShell,
  brandStyle,
  cardClass,
} from "@/components/analyticshub/shell-ui";
import { DesktopSidebar, MobileNav } from "@/components/analyticshub/sidebar";
import { Topbar } from "@/components/analyticshub/topbar";
import { Wizard } from "@/components/analyticshub/wizard";
import type { ProjectConfig } from "@/lib/analyticshub/types";

const DEFAULT_PROJECT: ProjectConfig = {
  name: "Analytics",
  primary: "#0e80cc",
  accent: "#e2f0fb",
};

export function HubShell({ children }: { children: ReactNode }) {
  return (
    <HubProvider initialStatus={null}>
      <Gate>{children}</Gate>
    </HubProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { screen, status } = useHub();
  if (!screen) return <FullscreenLoader />;
  if (screen === "config") return <ConfigError problems={status?.problems ?? []} />;
  if (screen === "wizard") return <Wizard />;
  if (screen === "login") return <Login />;
  return (
    <AppChrome project={status?.project ?? DEFAULT_PROJECT}>{children}</AppChrome>
  );
}

function FullscreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function ConfigError({ problems }: { problems: string[] }) {
  return (
    <CenteredShell>
      <div className={cardClass}>
        <h2 className="font-display text-lg font-semibold text-danger">
          Configuration needed
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          The analytics hub can&apos;t start until these are fixed:
        </p>
        <ul className="mt-4 space-y-2">
          {(problems.length ? problems : ["Unknown configuration error."]).map(
            (p, i) => (
              <li
                key={i}
                className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg"
              >
                {p}
              </li>
            ),
          )}
        </ul>
        <p className="mt-4 text-xs text-text-muted">
          See ANALYTICSHUB_SETUP.md. Environment variables only apply to
          deployments created after they&apos;re saved — redeploy after adding
          them.
        </p>
      </div>
    </CenteredShell>
  );
}

function AppChrome({
  project,
  children,
}: {
  project: ProjectConfig;
  children: ReactNode;
}) {
  return (
    <div
      className="flex h-screen overflow-hidden bg-surface-alt"
      style={brandStyle(project)}
    >
      <DesktopSidebar projectName={project.name} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main data-lenis-prevent className="flex-1 overflow-y-auto">
          <MobileNav />
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

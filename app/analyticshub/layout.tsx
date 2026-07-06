import type { Metadata } from "next";

import { HubShell } from "@/components/analyticshub/hub-shell";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

// The hub is a cookie-gated live dashboard — always rendered per request, never
// statically prerendered (nothing here is cacheable HTML).
export const dynamic = "force-dynamic";

export default function AnalyticsHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HubShell>{children}</HubShell>;
}

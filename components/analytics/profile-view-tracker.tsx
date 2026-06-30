"use client";

/**
 * ProfileViewTracker — fires a single, consent-gated `profile_view` beacon when
 * a clinic profile mounts (Stage 9.2 / PRD §15). Server-rendered profile pages
 * are statically cached (ISR), so views can't be counted at render time; this
 * client beacon attributes a view to the clinic without storing any PII. Renders
 * nothing.
 */
import * as React from "react";

import { trackClientEvent } from "@/lib/analytics-client";

export function ProfileViewTracker({ clinicId }: { clinicId: string }) {
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackClientEvent("profile_view", { clinicId });
  }, [clinicId]);

  return null;
}

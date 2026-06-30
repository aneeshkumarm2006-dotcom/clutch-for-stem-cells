"use client";

/**
 * CookieConsent — GDPR-style cookie/consent banner (Compliance §8.5 / PRD §14).
 *
 * Fully client-driven: the choice is stored in `localStorage` (not a server
 * cookie), so the public layout stays statically renderable (ISR) and reads no
 * request state. Until a choice is made, analytics that honour consent should
 * treat consent as absent — `hasAnalyticsConsent()` exposes the stored decision
 * for `lib/analytics` to gate non-essential tracking. Essential cookies (auth
 * session) are always allowed and are out of scope for this banner.
 */
import * as React from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/config/site";

const STORAGE_KEY = "sc:cookie-consent";

type Choice = "accepted" | "rejected";

/** Read the stored analytics-consent decision (client only). */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "accepted";
}

export function CookieConsent() {
  // Start hidden; reveal only after we confirm no prior choice exists. This
  // avoids a flash for returning visitors and keeps SSR output stable.
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== "accepted" && stored !== "rejected") setVisible(true);
    } catch {
      // localStorage unavailable (private mode / blocked) — show the banner so
      // the user can still make a choice this session.
      setVisible(true);
    }
  }, []);

  function choose(choice: Choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
      window.dispatchEvent(
        new CustomEvent("sc:cookie-consent", { detail: choice }),
      );
    } catch {
      /* ignore persistence failures */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-lg sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-tint text-azure-700">
            <Cookie className="size-[18px]" aria-hidden="true" />
          </span>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            {SITE_NAME} uses essential cookies to run the site and, with your
            consent, analytics cookies to understand how it&apos;s used. See our{" "}
            <Link
              href="/privacy"
              className="font-medium text-text-link hover:underline"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5 sm:ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => choose("rejected")}
          >
            Decline
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

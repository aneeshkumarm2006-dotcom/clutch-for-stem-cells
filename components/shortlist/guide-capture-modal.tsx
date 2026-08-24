"use client";

/**
 * GuideCaptureModal — the one email ask on the public site.
 *
 * Mounted once in the public layout, invisible until a trigger fires:
 *
 *   • the visitor opens their **second distinct** clinic profile, counted in
 *     `localStorage` from the URL (so /clinic/x, /clinic/x/reviews and
 *     /clinic/x/cost are all still clinic x), or
 *   • they save any clinic to their shortlist, announced by the shortlist
 *     provider through `SHORTLIST_ADD_EVENT`.
 *
 * Three rules sit in front of both triggers: never on the trust pages
 * (`isCaptureSuppressed`), never twice inside 30 days (`isCoolingDown`), and
 * never before the shortlist provider has hydrated. The cooldown is stamped the
 * moment the modal opens rather than when it is answered, so a visitor who
 * closes the tab is not asked again tomorrow.
 *
 * Deriving the clinic view from `usePathname` keeps the whole feature in this
 * one file: no clinic page has to mount a tracker, and any future clinic
 * sub-route is covered the day it ships.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ClipboardList, Mail } from "lucide-react";

import {
  CAPTURE_COPY,
  CAPTURE_OPEN_DELAY_MS,
  clinicSlugFromPath,
  isCaptureSuppressed,
} from "@/config/guide-capture";
import { trackClientEvent } from "@/lib/analytics-client";
import {
  SHORTLIST_ADD_EVENT,
  hasReachedProfileThreshold,
  isCoolingDown,
  markCaptured,
  markShown,
  readExternalReferrer,
  readUtm,
  readViewedClinics,
  recordClinicView,
} from "@/lib/guide-capture-store";
import { useShortlist } from "@/lib/hooks/use-shortlist";
import { Button } from "@/components/ui/button";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import {
  COOKIE_CONSENT_EVENT,
  isCookieChoicePending,
} from "@/components/compliance/cookie-consent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form-field";
import { useSpamGuard } from "@/components/forms/spam-guard";
import type { CaptureTrigger } from "@/lib/enums";

export function GuideCaptureModal() {
  const pathname = usePathname();
  const { slugs, ready } = useShortlist();
  const spam = useSpamGuard();

  const [open, setOpen] = React.useState(false);
  const [trigger, setTrigger] = React.useState<CaptureTrigger>("second-profile");
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-read on every render: a client-side navigation can move the visitor onto
  // (or off) a trust page while the modal logic is live.
  const suppressed = isCaptureSuppressed(pathname);

  // Once a trigger has fired this page-load we stop evaluating. Without it a
  // dismissed modal would reopen on the next navigation inside the same tab,
  // where the 30-day gate is already stamped but React state has moved on.
  const firedRef = React.useRef(false);
  // A trigger that arrived while the cookie banner was still unanswered, held
  // until it is. Nothing is stamped in the meantime, so the visitor does not
  // silently burn their one showing in the 30-day window.
  const heldTriggerRef = React.useRef<CaptureTrigger | null>(null);

  const openModal = React.useCallback((why: CaptureTrigger) => {
    if (firedRef.current) return;
    if (isCoolingDown()) return;
    // Never two asks at once. The banner is fixed to the bottom of the viewport
    // and would sit half-covered behind this dialog.
    if (isCookieChoicePending()) {
      heldTriggerRef.current = why;
      return;
    }
    firedRef.current = true;
    // Stamp before the delay, not after: a visitor who navigates away during
    // the delay has still effectively been asked.
    markShown();
    setTrigger(why);
    window.setTimeout(() => {
      setOpen(true);
      trackClientEvent("guide_modal_shown", { props: { trigger: why } });
    }, CAPTURE_OPEN_DELAY_MS);
  }, []);

  // Release a held trigger the moment the banner is answered either way.
  React.useEffect(() => {
    const onChoice = () => {
      const held = heldTriggerRef.current;
      if (!held) return;
      heldTriggerRef.current = null;
      if (isCaptureSuppressed(window.location.pathname)) return;
      openModal(held);
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onChoice);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChoice);
  }, [openModal]);

  // Trigger A: the second distinct clinic profile.
  React.useEffect(() => {
    if (!ready || suppressed) return;
    const slug = clinicSlugFromPath(pathname);
    if (!slug) return;
    const count = recordClinicView(slug);
    if (hasReachedProfileThreshold(count)) openModal("second-profile");
  }, [pathname, ready, suppressed, openModal]);

  // Trigger B: a clinic was just saved to the shortlist.
  React.useEffect(() => {
    if (!ready) return;
    const onAdd = () => {
      // Read the path off the DOM rather than the closure: the listener
      // outlives the render that installed it.
      if (isCaptureSuppressed(window.location.pathname)) return;
      openModal("shortlist-add");
    };
    window.addEventListener(SHORTLIST_ADD_EVENT, onAdd);
    return () => window.removeEventListener(SHORTLIST_ADD_EVENT, onAdd);
  }, [ready, openModal]);

  // A suppressed page closes an open modal, so a visitor who clicks through to
  // the disclaimer from inside it is not followed there.
  React.useEffect(() => {
    if (suppressed) setOpen(false);
  }, [suppressed]);

  const shortlistSlugs = React.useMemo(() => [...slugs], [slugs]);
  const hasShortlist = shortlistSlugs.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!value) {
      setError("Enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          trigger,
          shortlistSlugs,
          profileViewCount: readViewedClinics().length,
          path: pathname,
          referrer: readExternalReferrer(),
          utm: readUtm(),
          ...spam.payload(),
        }),
      });
      if (res.ok) {
        markCaptured();
        setDone(true);
        return;
      }
      // Turnstile tokens are single-use — re-arm before they retry.
      spam.reset();
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      spam.reset();
      setError("We could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    if (!done) {
      trackClientEvent("guide_modal_dismissed", { props: { trigger } });
    }
    setOpen(false);
  }

  if (suppressed) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-[460px]">
        {done ? (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-success-bg text-[#07623F]">
              <Check className="size-5" aria-hidden="true" />
            </span>
            <DialogHeader>
              <DialogTitle>{CAPTURE_COPY.successTitle}</DialogTitle>
              <DialogDescription>{CAPTURE_COPY.successBody}</DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)} className="w-full">
              Back to browsing
            </Button>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-tint text-azure-700">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>

            <DialogHeader>
              <DialogTitle className="pr-6">{CAPTURE_COPY.title}</DialogTitle>
              <DialogDescription>
                {hasShortlist
                  ? CAPTURE_COPY.bodyWithShortlist
                  : CAPTURE_COPY.bodyEmptyShortlist}
              </DialogDescription>
            </DialogHeader>

            <ul className="grid gap-2">
              {CAPTURE_COPY.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-2 text-[13.5px] leading-relaxed text-text-secondary"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {bullet}
                </li>
              ))}
            </ul>

            <form onSubmit={submit} className="grid gap-3">
              <TextField
                label={CAPTURE_COPY.emailLabel}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                leadingIcon={Mail}
                placeholder={CAPTURE_COPY.emailPlaceholder}
                value={email}
                error={error ?? undefined}
                onChange={(e) => setEmail(e.target.value)}
              />

              {spam.fields}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting
                  ? CAPTURE_COPY.submitBusyLabel
                  : CAPTURE_COPY.submitLabel}
              </Button>
            </form>

            <p className="text-[12px] leading-relaxed text-text-muted">
              {CAPTURE_COPY.privacyNote}{" "}
              <Link
                href="/privacy"
                className="font-medium text-text-link hover:underline"
              >
                Privacy policy
              </Link>
              .
            </p>

            {/* The standard site-wide medical line, inside the modal (§8.1). */}
            <DisclaimerNote variant="medical" />

            <button
              type="button"
              onClick={close}
              className="text-[12.5px] font-medium text-text-muted transition-colors hover:text-text-secondary"
            >
              {CAPTURE_COPY.dismissLabel}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

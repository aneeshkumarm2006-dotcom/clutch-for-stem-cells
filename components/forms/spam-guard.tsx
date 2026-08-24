"use client";

/**
 * Client half of the spam guard — shared by every public form.
 *
 *   const spam = useSpamGuard();
 *
 *   <form onSubmit={…}>
 *     …
 *     {spam.fields}                       ← honeypot + captcha widget
 *   </form>
 *
 *   body: JSON.stringify({ ...values, ...spam.payload() })
 *   if (!res.ok) spam.reset();            ← captcha tokens are single-use
 *
 * Three things go over the wire:
 *
 *  • `hp` — a honeypot input. Off-screen rather than `display:none` (some bots
 *    skip hidden fields), never focusable, `autocomplete="off"`, and labelled
 *    `aria-hidden` so screen readers don't offer it either.
 *
 *  • `elapsedMs` — milliseconds between mount and submit. Both readings come
 *    from the *same* clock, so a wrong system time can't produce a bogus value.
 *    A direct POST sends nothing at all, which the server treats as a weak
 *    signal (a stale cached bundle also sends nothing — see classify.ts).
 *
 *  • `captchaToken` — only when a site key comes back from `/api/form-config`.
 *    Until the keys are set in the environment, this is `undefined` and the
 *    server-side check is a no-op.
 */
import * as React from "react";

import type { FormConfigResponse } from "@/app/api/form-config/route";

/** The Turnstile browser API, as much of it as we use. */
interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Load the Turnstile script once per page, however many forms ask for it. */
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile")));
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(script);
  }).catch((err) => {
    // Let a later mount retry rather than caching the failure forever.
    scriptPromise = null;
    throw err;
  });

  return scriptPromise;
}

export interface SpamGuard {
  /** Render inside the `<form>`. */
  fields: React.ReactNode;
  /** Merge into the request body. */
  payload: () => { hp: string; elapsedMs: number; captchaToken?: string };
  /** Call after a failed submit — a Turnstile token is single-use. */
  reset: () => void;
}

export function useSpamGuard(): SpamGuard {
  const mountedAt = React.useRef<number>(Date.now());
  const honeypotRef = React.useRef<HTMLInputElement>(null);
  // A *callback* ref, not `useRef`. Every caller renders `fields` inside a
  // Radix dialog, and Radix only mounts its content when the dialog opens: an
  // object ref is still null when the config arrives, the render effect below
  // bails, and nothing ever re-runs it, so the widget never appears and every
  // submission is refused for a missing token. Holding the node in state makes
  // the effect depend on the node actually being in the DOM, so it renders when
  // the dialog opens and re-renders if it is closed and opened again.
  const [widgetEl, setWidgetEl] = React.useState<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const tokenRef = React.useRef<string | undefined>(undefined);

  const [config, setConfig] = React.useState<FormConfigResponse["captcha"]>(null);

  // Ask the server whether a captcha is configured. A failure here leaves the
  // widget absent, which is the same as "not configured" — the form still works.
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/form-config");
        if (!res.ok) return;
        const data = (await res.json()) as FormConfigResponse;
        // Only Turnstile has a client implementation here; if the provider is
        // ever switched to hCaptcha, the widget stays absent (and the server
        // will then refuse every submission — so switch both together).
        if (active && data.captcha?.provider === "turnstile") {
          setConfig(data.captcha);
        }
      } catch {
        /* offline or blocked — treat as not configured */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Render the widget once the key, the script, and the container are all
  // available.
  React.useEffect(() => {
    if (!config?.siteKey || !widgetEl) return;
    let active = true;

    void loadTurnstile()
      .then(() => {
        if (!active || !window.turnstile) return;
        if (widgetIdRef.current !== null) return;
        widgetIdRef.current = window.turnstile.render(widgetEl, {
          sitekey: config.siteKey,
          // Real visitors see nothing; the challenge only appears if Cloudflare
          // decides this session needs interaction.
          appearance: "interaction-only",
          callback: (token) => {
            tokenRef.current = token;
          },
          // Tokens expire after ~5 minutes. Clear ours and re-run so a slow
          // form-filler isn't refused on submit.
          "expired-callback": () => {
            tokenRef.current = undefined;
            if (widgetIdRef.current !== null) {
              window.turnstile?.reset(widgetIdRef.current);
            }
          },
          "error-callback": () => {
            tokenRef.current = undefined;
          },
        });
      })
      .catch(() => {
        /* script blocked — submissions proceed without a token */
      });

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [config?.siteKey, widgetEl]);

  const payload = React.useCallback(
    () => ({
      hp: honeypotRef.current?.value ?? "",
      elapsedMs: Date.now() - mountedAt.current,
      captchaToken: tokenRef.current,
    }),
    [],
  );

  const reset = React.useCallback(() => {
    tokenRef.current = undefined;
    if (widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const fields = (
    <>
      {/*
        Honeypot. Positioned off-screen instead of `display:none` because some
        bots skip fields they can tell are hidden. Never announced, never
        focusable, never autofilled.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor="website-url-confirm">Leave this field empty</label>
        <input
          ref={honeypotRef}
          id="website-url-confirm"
          name="website-url-confirm"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      {config?.siteKey ? <div ref={setWidgetEl} className="mt-1" /> : null}
    </>
  );

  return { fields, payload, reset };
}

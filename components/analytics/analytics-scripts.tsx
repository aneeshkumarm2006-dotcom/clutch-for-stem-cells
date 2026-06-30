"use client";

/**
 * AnalyticsScripts — loads product-analytics providers in the browser
 * (Stage 9.2 / PRD §15), gated on cookie consent (Stage 8.5).
 *
 * Providers (GA4, Plausible, PostHog) are configured in admin Settings and
 * passed in as props by the server layout. Scripts are injected **only** after
 * the visitor accepts analytics cookies — we read the stored decision and also
 * react live to the `sc:cookie-consent` event the banner dispatches, so an
 * Accept click starts tracking without a reload. Nothing renders (and no network
 * request fires) for visitors who declined or haven't chosen.
 */
import * as React from "react";
import Script from "next/script";

import { hasAnalyticsConsent } from "@/components/compliance/cookie-consent";
import type { ResolvedAnalyticsConfig } from "@/lib/analytics";

export function AnalyticsScripts({
  config,
}: {
  config: ResolvedAnalyticsConfig;
}) {
  const [consented, setConsented] = React.useState(false);

  React.useEffect(() => {
    setConsented(hasAnalyticsConsent());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setConsented(detail === "accepted");
    };
    window.addEventListener("sc:cookie-consent", onChange);
    return () => window.removeEventListener("sc:cookie-consent", onChange);
  }, []);

  const { ga4Id, plausibleDomain, posthogKey, posthogHost } = config;
  const anyConfigured = Boolean(ga4Id || plausibleDomain || posthogKey);
  if (!consented || !anyConfigured) return null;

  return (
    <>
      {ga4Id ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {plausibleDomain ? (
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      ) : null}

      {posthogKey ? (
        <Script id="posthog-init" strategy="afterInteractive">
          {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${posthogKey}',{api_host:'${posthogHost}',persistence:'localStorage',autocapture:false});`}
        </Script>
      ) : null}
    </>
  );
}

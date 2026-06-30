/**
 * Public site shell (Stage 5). Wraps every public route with the sticky Navbar,
 * Footer, and the shortlist provider (guest localStorage → synced on login,
 * PRD §7). The provider is fully client-driven, so this layout reads no cookies
 * and content pages stay statically renderable (ISR). All public pages render
 * fully for unauthenticated users (PRD §6 intro).
 */
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AccountNav } from "@/components/layout/account-nav";
import { CookieConsent } from "@/components/compliance/cookie-consent";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { getAnalyticsConfig } from "@/lib/analytics";
import { ShortlistProvider } from "@/lib/hooks/use-shortlist";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Provider config (admin Settings → env fallback). Read here so the client
  // scripts can load post-consent; cached, so it doesn't force dynamic render.
  const analyticsConfig = await getAnalyticsConfig();

  return (
    <ShortlistProvider>
      {/* Skip link — first focusable element for keyboard users (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <Navbar searchInNav account={<AccountNav />} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <CookieConsent />
      </div>
      <AnalyticsScripts config={analyticsConfig} />
    </ShortlistProvider>
  );
}

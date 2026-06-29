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
import { ShortlistProvider } from "@/lib/hooks/use-shortlist";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShortlistProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar searchInNav account={<AccountNav />} />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ShortlistProvider>
  );
}

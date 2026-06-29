import type { Metadata } from "next";

import { inter, jakarta } from "./fonts";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_TAGLINE,
  SITE_URL,
} from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        <AuthSessionProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="top-right" />
          </TooltipProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

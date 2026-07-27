import type { Metadata } from "next";

import { inter, jakarta } from "./fonts";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import SmoothScroll from "@/components/smooth-scroll";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_TAGLINE,
  SITE_URL,
} from "@/config/site";
import { META_SEPARATOR } from "@/lib/meta-text";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // The pipe is the only separator a meta tag may carry — see `lib/meta-text.ts`.
  title: {
    default: `${SITE_NAME} ${META_SEPARATOR} ${SITE_TAGLINE}`,
    template: `%s ${META_SEPARATOR} ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  verification: {
    google: "IXGaDh1jqTmUq_C_V_uqXqT5V8Rzw6QqsIXLIKA0JS4",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        <SmoothScroll />
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

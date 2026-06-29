import * as React from "react";

/**
 * Auth layout — Stage 2.5. Centers the auth card on the app background. Each
 * page renders its own `AuthCard` (mark + title live inside the card, matching
 * `Auth.dc.html`).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {children}
    </main>
  );
}

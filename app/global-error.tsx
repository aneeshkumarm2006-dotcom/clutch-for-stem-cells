"use client";

/**
 * Root error boundary (Stage 9.7 / PRD §13). Catches errors thrown in the root
 * layout itself — it must render its own <html>/<body> because it *replaces* the
 * root layout. Segment errors are handled by the closer `error.tsx` boundaries;
 * this is the last line of defence. No PII is logged (PRD §13).
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Root error boundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "1rem",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: "0.5rem", maxWidth: "28rem", color: "#475569" }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1.5rem",
            borderRadius: "0.375rem",
            backgroundColor: "#0e80cc",
            color: "white",
            padding: "0.5rem 1.25rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

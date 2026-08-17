/**
 * SMTP connect-and-auth check — sends NOTHING.
 *
 * Usage: npx tsx scripts/verify-smtp.ts
 *
 * Loads `.env.local` (same `@next/env` loader the other scripts use), then
 * runs `verifyTransport()` from `lib/email` — the exact transport the app
 * uses — and reports whether the SMTP server accepted the credentials. Run it
 * after changing SMTP_* values; it catches bad app passwords (535), blocked
 * egress (ETIMEDOUT → try SMTP_PORT=587), and quote-wrapped or truncated
 * values. The password itself is never printed — length only.
 */
async function main(): Promise<void> {
  const mod = await import("@next/env");
  const ns = mod as unknown as {
    default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
    loadEnvConfig?: typeof mod.loadEnvConfig;
  };
  (ns.default?.loadEnvConfig ?? ns.loadEnvConfig)?.(process.cwd());

  // Import after the env load — lib/email reads SMTP_* at module scope.
  const { verifyTransport } = await import("@/lib/email");

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT || "465";
  const user = process.env.SMTP_USER || "(unset)";
  const passLen = (process.env.SMTP_PASS ?? "").length;
  console.log(
    `Verifying SMTP ${host}:${port} as ${user} (password: ${passLen ? `${passLen} chars` : "unset"})…`,
  );

  const result = await verifyTransport();
  if (result.ok) {
    console.log("✅ Connected and authenticated. No mail was sent.");
    return;
  }
  console.error(`❌ ${result.skipped ?? result.error ?? "Unknown failure."}`);
  process.exitCode = 1;
}

void main();

# AnalyticsHub — setup guide

A self-configuring analytics dashboard at **`/analyticshub`**, built natively
into the My Stem Cell Guide Next.js app. Single owner, password-protected, self-hosted
on Vercel. All data-source credentials are entered through the dashboard's own
Settings page — never in code.

- **Overview** — the five-second "how did we do?" (KPI cards + comparison chart + top-5 strips)
- **Per-source pages** — Analytics (GA4), Search Console, Meta Ads, Google Ads, Users
- **Settings** — connection cards + project identity + change password

The entire backend is **one serverless function** (`app/api/analyticshub/[...path]/route.ts`).
Config is stored **encrypted** (AES-256-GCM) in a MongoDB collection
(`analyticshub_config`) — no extra database, no KV.

---

## 1. Shared Google OAuth app (once, ever — optional)

Enables the "Sign in with Google" button for GA4 + Search Console. If you skip
this, the dashboard still works via the **service-account** path (Settings →
Google → Service account).

1. Create (or reuse) a Google Cloud project.
2. **Enable these APIs:** Google Analytics Data API, Google Analytics Admin API,
   Google Search Console API.
3. **OAuth consent screen:** External. Add yourself as a Test user (or Publish).
4. **Credentials → Create OAuth client ID → Web application.** Under
   *Authorized redirect URIs* add, for **each** deployment:

   ```
   https://<your-domain>/api/analyticshub/oauth/google/callback
   ```

   (also add `http://localhost:3000/api/analyticshub/oauth/google/callback` for
   local dev).
5. Copy the **Client ID** and **Client secret** → the two `GOOGLE_OAUTH_*` env
   vars below.

> Scopes requested (read-only): `analytics.readonly`, `webmasters.readonly`.
> The app uses `access_type=offline` + `prompt=consent` so re-grants always
> return a refresh token.

---

## 2. Environment variables (three)

Add these to your Vercel project (and to `site/.env.local` for local dev). See
`.env.example` for the annotated block.

| Var | Required | What |
| --- | --- | --- |
| `ANALYTICSHUB_SECRET_KEY` | **Yes** | Root secret. Generate: `openssl rand -base64 32` — paste the raw 44-char output, **no quotes**. HKDF derives both the AES data key and the session-cookie HMAC key from this one value. |
| `GOOGLE_OAUTH_CLIENT_ID` | No | From step 1. Omit to hide the "Sign in with Google" button (service-account path only). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | No | From step 1. |

No KV credentials are needed — the hub reuses the existing `MONGODB_URI`.
Meta and Google Ads credentials are entered **in the dashboard**, not here.

> ⚠️ **Changing `ANALYTICSHUB_SECRET_KEY` later orphans everything stored**
> (all encrypted tokens + the password hash become undecryptable). Pick it once.
>
> ⚠️ **Env vars only bake into deployments created *after* they're saved.**
> Always **redeploy** after adding or changing one.

---

## 3. Migration / grants

**Nothing to run.** The storage backend is MongoDB, so the `analyticshub_config`
collection is created automatically on first write, and there are no
column-level GRANTs to manage (that only applies to the Postgres path). If your
`MONGODB_URI` user can already read/write the app's other collections, it can
read/write this one.

The Users source reads the existing `User` collection
(`role: "member"`, not soft-deleted) — no new permissions required.

---

## 4. First run (do this right after deploy)

Setup is **first-claim** — whoever completes it first owns the dashboard, so do
it immediately.

1. Visit `https://<your-domain>/analyticshub`.
2. **Create a password** (min 8 chars, confirm). **There is no reset flow** —
   store it safely.
3. **Confirm the project** (name + brand colours — pre-filled, editable).
4. **Connect sources** (all skippable — you can add them later in Settings).
5. Land on Overview.

After setup, logging out shows a login screen; logging back in restores the app.

---

## 5. Connecting the optional ad sources

### Meta Ads (optional)

1. In **Meta Business Settings**, create a **System User** with the
   **`ads_read`** permission.
2. Generate a **long-lived access token** for it.
3. Settings → Meta Ads → paste the token → **Validate** → pick an ad account →
   **Save**. (Every save is validated live; a bad token shows Meta's own error.)

### Google Ads (advanced — the most involved, optional)

You need five things (Settings → Google Ads validates them with a 1-row query):

1. **Developer token** — from your Google Ads *manager* account (API Center).
2. **OAuth client ID + secret** — a Google Cloud OAuth client with the
   `https://www.googleapis.com/auth/adwords` scope.
3. **Refresh token** — generate once via the OAuth playground using that client.
4. **Customer ID** — the 10-digit account number (dashes are stripped for you).
5. **Login customer ID (MCC)** — only if you access via a manager account.

Google Ads never blocks anything else; leave it disconnected if you don't use it.

---

## 6. Local development

`next dev` serves the whole hub — pages **and** the catch-all API — natively.
No separate dev server or Vercel CLI is required.

```bash
cd site
# .env.local needs: MONGODB_URI, ANALYTICSHUB_SECRET_KEY
#                   (+ GOOGLE_OAUTH_* if testing Google sign-in)
npm run dev
# open http://localhost:3000/analyticshub
```

Run the hub's tests (crypto round-trip + tamper, scrypt, session, and the full
first-run dispatch flow against a stubbed store):

```bash
npm test
```

---

## 7. Troubleshooting (every error names its fix)

The dashboard's config screen and `/api/analyticshub/status` distinguish:

- **Secret missing** — `ANALYTICSHUB_SECRET_KEY` isn't set → set it, redeploy.
- **Secret not 32 bytes** — it reports the decoded length → regenerate with
  `openssl rand -base64 32`.
- **Database unreachable** — check `MONGODB_URI` and that Atlas allows the
  deployment's IP.
- **Reconnect needed** on a source — the token was revoked/expired → reconnect
  that source in Settings (other sources keep working).

A revoked Google refresh token or expired Meta token flips only that source to
"Reconnect needed" — in status, on the dashboard, and in Settings.

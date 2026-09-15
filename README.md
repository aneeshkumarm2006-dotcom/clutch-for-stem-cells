# My Stem Cell Guide

A Clutch-style discovery & review marketplace for stem cell / regenerative-medicine clinics.

> The brand name is defined in one place via `SITE_NAME` in [`config/site.ts`](config/site.ts).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS v3 · shadcn/ui-style primitives · MongoDB (Mongoose) · Auth.js · Vercel.

Design system: **Azure Clinical** — see [`../_ai_context/Design_Stem.md`](../_ai_context/Design_Stem.md).
Product spec: [`../_ai_context/PRD_Stem.md`](../_ai_context/PRD_Stem.md). Build plan: [`../_ai_context/TODO.md`](../_ai_context/TODO.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI etc.
npm run dev                  # http://localhost:3000
```

Scripts: `dev` · `build` · `start` · `lint` · `format` · `format:check` · `seed` · `indexnow:ping`.

## Project structure

```
app/
  (public)/        Public marketing + directory pages (Stage 5)
  admin/           Role-gated admin panel (Stage 6)
  api/auth/        NextAuth handler + register/verify/reset routes (Stage 2)
  auth/            Sign-in / sign-up / reset pages (Stage 2.5)
  fonts.ts         next/font (Inter + Plus Jakarta Sans) — Design §4.1
  globals.css      Azure Clinical token layer — Design §14.1
  layout.tsx       Root layout (fonts, SessionProvider, Toaster, Tooltip)
  page.tsx         Stage 0 foundation showcase (replaced in Stage 5.1)
components/
  auth/            Auth forms + card shell + SessionProvider (Stage 2.5)
  brand/           Logo / cell mark — Design §2
  ui/              Themed shadcn-style primitives — Design §10
config/site.ts     SITE_NAME, currency, feature flags — PRD §12
lib/
  auth/            authOptions + RBAC helpers + password/token utils (Stage 2)
  email.ts         SMTP email via nodemailer (auth + owner lead notifications)
  db.ts            Cached Mongoose connection (serverless-safe)
  utils.ts         cn() class merge helper
  validation/      Shared Zod schemas (Stage 1.10)
  hooks/           Client hooks
middleware.ts      Edge route gating for /admin + /account (Stage 2.3)
models/            Mongoose models (Stage 1)
scripts/seed.ts    Seed taxonomy + demo data (Stage 1.11)
types/             Module augmentation (next-auth session/JWT claims)
```

## Auth & roles (Stage 2)

Auth.js (NextAuth v4) with **credentials + Google**, JWT sessions carrying
`role` + `status`. Server code authorizes via `lib/auth` (`getCurrentUser`,
`requireRole`, `requireApiRole`); `middleware.ts` gates `/admin`
(Editor/Admin/SuperAdmin) and `/account` (authenticated). Email verification,
password reset, and owner lead notifications go out over SMTP from our own
mailbox (nodemailer + Gmail app password) — with `SMTP_USER`/`SMTP_PASS` unset,
emails are logged to the server console so the flows are testable locally.
`/api/admin/email-test` (Admin+) reports the live SMTP config and can send a
test message; `npx tsx scripts/verify-smtp.ts` checks auth without sending.

The seeded SuperAdmin (`admin@mystemcellguide.com`) ships without a password —
use **Reset your password** (`/auth/reset`) to set one, then sign in.

## IndexNow (instant indexing)

[IndexNow](https://www.indexnow.org/) is a free, open protocol: one POST tells
**Bing, Yandex, Naver, Seznam and Yep** that a URL was published, changed, or
removed, instead of waiting for them to crawl. **Google does not participate** —
`app/sitemap.ts` remains how Googlebot discovers content, and nothing here
changes it. The payoff is Bing, which is a primary retrieval layer for ChatGPT
Search, so a same-minute push there is the fastest route into AI answers.

No paid API, no new runtime dependency — native `fetch` only.

### One-time setup

There is exactly one manual step, and it is the one thing that silently
disables IndexNow if it is wrong. Do it in this order:

1. **Get a key.** [bing.com/webmasters](https://www.bing.com/webmasters) →
   **IndexNow** → generate. It looks like `a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d`.
2. **Commit the key file.** Create `public/<key>.txt` containing *exactly* that
   key and nothing else, and commit it. The engines fetch it to prove you own
   the host, so **it is public by design and is not a secret.**
3. **Set `INDEXNOW_KEY`** to the same value in Vercel (Production scope) and as
   a GitHub Actions **repository secret** of the same name.
4. **Set a `SITE_URL` repository variable** (e.g. `https://your-domain.com`) so
   the workflow knows where to read production's sitemap.
5. **Verify**, after the deploy that carries the key file:

   ```bash
   NEXT_PUBLIC_SITE_URL=https://your-domain.com npm run indexnow:ping -- --verify
   ```

   This fetches the key file and checks it byte-for-byte against `INDEXNOW_KEY`.
   Until it says OK, every submission is answered 403/422.
6. **Backfill once**, to submit the existing site:

   ```bash
   NEXT_PUBLIC_SITE_URL=https://your-domain.com npm run indexnow:ping -- --all
   ```

With `INDEXNOW_KEY` unset, everything below is a silent no-op, so a fresh clone
needs none of this. Submissions are also skipped unless `VERCEL_ENV` is
`production`, so dev and preview deploys never ping.

### What submits, and when

| Trigger | Covers |
| --- | --- |
| `lib/indexnow.ts` → `pingIndexNow()` in the publish routes | Blog posts (`/api/seoteam/posts`), composed pages (`/api/seoteam/pages`), per-route meta (`/api/admin/page-seo`). Create, update, unpublish, delete, and both slugs on a rename. |
| `.github/workflows/indexnow.yml` | Everything the routes cannot see: URLs that ship with a code change (clinics, taxonomy, tools) and content written straight to MongoDB by `scripts/import-*.ts`. Diffs production's `sitemap.xml` against the previous run's snapshot and submits only what changed. |
| `npm run indexnow:ping` | Manual backfill and repair. Takes URLs as arguments, or `--all` for every sitemap URL; `--dry` lists without submitting, `--verify` checks the key file. |

`pingIndexNow` is **fire-and-forget**: it returns `void`, is never awaited, and
cannot delay or fail the response it rides along with. Every failure mode (no
key, network error, a 4xx) degrades to a log line — the same discipline
`app/sitemap.ts` uses when the database is unreachable. A 403 or 422 is logged
loudly, because a bad key file is the one failure nothing else surfaces.

Only canonical, indexable URLs are submitted: query strings (faceted directory
variants are `noindex` with a canonical back to the clean path), fragments,
off-host URLs, and private prefixes (`/admin`, `/api/`, `/auth/`, `/account`,
`/seoteam`, `/analyticshub`, `/r/`) are dropped before the request is built.

Two deliberate behaviours in the workflow worth knowing:

- It triggers on `deployment_status` (production success) rather than `push`,
  because a push-triggered job races Vercel: it would read the *previous*
  build's sitemap, snapshot it as current, and then never submit those URLs.
  This needs the Vercel↔GitHub integration; without it, the 6-hourly schedule
  and `workflow_dispatch` still cover everything.
- Its **first** run submits nothing and only seeds the snapshot, so enabling it
  never fires the whole site at the engines unannounced. Use `--all` (step 6)
  or a `workflow_dispatch` with `submit_all` for that.

## Design tokens

Defined as CSS variables in [`app/globals.css`](app/globals.css) and surfaced to
Tailwind via [`tailwind.config.ts`](tailwind.config.ts). Components reference the
semantic tokens (`bg-primary`, `text-text-secondary`, `border-border`, `shadow-card`,
`rounded-xl`, …) — never raw hex.

## Conventions

- `MUST` / `SHOULD` / `MAY` per the build plan; defaults left with `// PRD-ASSUMPTION` notes.
- Public URLs use slugs; clinics/reviews/users are soft-deleted.
- Authorization is enforced **server-side** on every admin/API route.

# StemConnect

A Clutch-style discovery & review marketplace for stem cell / regenerative-medicine clinics.

> Brand name "StemConnect" is a placeholder (PRD §7 / Q7) — change it in one place via `SITE_NAME` in [`config/site.ts`](config/site.ts).

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

Scripts: `dev` · `build` · `start` · `lint` · `format` · `format:check` · `seed`.

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
  email.ts         Resend transactional email (Stage 2; extended in 3.5)
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
(Editor/Admin/SuperAdmin) and `/account` (authenticated). Email verification and
password reset go through Resend — with `RESEND_API_KEY` unset, links are logged
to the server console so the flows are testable locally.

The seeded SuperAdmin (`admin@stemconnect.example`) ships without a password —
use **Reset your password** (`/auth/reset`) to set one, then sign in.

## Design tokens

Defined as CSS variables in [`app/globals.css`](app/globals.css) and surfaced to
Tailwind via [`tailwind.config.ts`](tailwind.config.ts). Components reference the
semantic tokens (`bg-primary`, `text-text-secondary`, `border-border`, `shadow-card`,
`rounded-xl`, …) — never raw hex.

## Conventions

- `MUST` / `SHOULD` / `MAY` per the build plan; defaults left with `// PRD-ASSUMPTION` notes.
- Public URLs use slugs; clinics/reviews/users are soft-deleted.
- Authorization is enforced **server-side** on every admin/API route.

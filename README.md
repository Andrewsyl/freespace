# FreeSpace

Peer-to-peer parking marketplace for Ireland. Hosts list private spaces; drivers search a
map, book, and pay via Stripe. Live at [freespace.ie](https://freespace.ie).

## Structure

Yarn-workspaces monorepo:

- `apps/api` — Express + TypeScript (ESM), Postgres/PostGIS via `pg` (no ORM), Zod,
  Stripe. App assembled in `src/app.ts`; env validated in `src/env.ts` (boot fails on bad
  config); all SQL in `src/lib/db.ts`.
- `apps/web` — Next.js 15 App Router + Tailwind + Mapbox GL. API client: `lib/api.ts`.
- `apps/mobile` — Expo SDK 54 / React Native. React Navigation, SecureStore-backed auth,
  Stripe Payment Sheet. API client: `api.ts`. Per-environment build lanes via
  `app.config.js` + `.env.<env>` and EAS profiles.
- `db/migrations` — append-only numbered SQL files, applied in filename order by
  `apps/api/src/migrate.ts` (one transaction per file, tracked in `schema_migrations`).

The API contract is hand-mirrored into both clients — new endpoints need matching updates
in `apps/web/lib/api.ts` and/or `apps/mobile/api.ts`.

Project conventions and invariants live in [AGENTS.md](AGENTS.md); the deep reference is
`docs/ENGINEERING_HANDBOOK.md`.

## Getting started

```bash
npm install
npm run dev:api            # API on :4000
npm run dev:web            # web on :3000
npm run dev:mobile         # Expo (runs adb reverse tcp:4000 first for Android)
```

Copy `.env.example` → `.env` per app. Postgres needs PostGIS:
`CREATE EXTENSION IF NOT EXISTS postgis;`. Migrations run via `apps/api/src/migrate.ts`
(applied automatically on deploy).

Key env vars: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
`GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_MAPBOX_TOKEN`, S3 credentials for image upload,
`ANTHROPIC_API_KEY` for AI listing descriptions.

## Testing

```bash
npm run test:api           # vitest + supertest (DB mocked)
npm run test:mobile        # jest (includes the pricing-parity suite)
npm run typecheck:mobile
npm run test:web:e2e:local # Playwright — boots API + web
npm run test:mobile:e2e    # Maestro flows
npm run prepush:check      # full gate: tests, lint, builds, web e2e
npm run check:migrations   # migration sanity
```

Note: pricing logic is duplicated by design between the API and the clients
(`apps/mobile/utils/pricing.ts`, `apps/web/lib/pricing.ts`) and verified against the
server on every booking — change all of them together, with their test suites, or
bookings fail the server-side amount check.

## Deployment

Push to `main` → GitHub Actions → container build → deploy → migrate → smoke checks.
API served at `https://api.freespace.ie`. Mobile releases are built with EAS
(`cd apps/mobile && npm run eas:qa` / `eas:prod`). See [DEPLOYMENT.md](DEPLOYMENT.md) and
`docs/ops/` for runbooks.

## Admin

Role-gated UI at `/admin` (users, listings, bookings, payments, payouts, support).

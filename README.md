# FreeSpace

Peer-to-peer parking marketplace for Ireland. Hosts list private spaces — driveways,
garages, gated spots — and drivers search a map for a time window, book, and pay via
Stripe. The ~8% platform fee is baked into the price the driver sees. Web live at
[freespace.ie](https://freespace.ie); the mobile apps ship through EAS.

Conventions and the invariants that must not be broken are in [AGENTS.md](AGENTS.md);
`docs/ENGINEERING_HANDBOOK.md` is the deep reference.

## Layout

Yarn-workspaces monorepo.

| Path | What |
|---|---|
| `apps/api/` | Express + TypeScript (ESM). Raw `pg` + PostGIS, no ORM — all SQL lives in `src/lib/db.ts`. App assembled in `src/app.ts`, background loops in `src/index.ts`, env Zod-validated in `src/env.ts` (boot fails on bad config). |
| `apps/web/` | Next.js 15 App Router + Tailwind + Mapbox GL. Search, booking, host wizard, role-gated `/admin` (users, listings, bookings, payments, payouts, support). API client: `lib/api.ts`. |
| `apps/mobile/` | Expo SDK 54 / React Native. React Navigation, SecureStore auth, Stripe Payment Sheet. Per-environment lanes via `app.config.js` + `.env.<env>` and EAS profiles. API client: `api.ts`. |
| `db/migrations/` | Append-only numbered SQL, applied in filename order by `apps/api/src/migrate.ts` — one transaction per file, tracked in `schema_migrations`. |

## Getting started

Requires Node 20 and Postgres with PostGIS (the compose file provides both).

```bash
npm install
docker compose up -d                          # Postgres + PostGIS on :5432
cp apps/api/.env.example apps/api/.env        # set DATABASE_URL and JWT_SECRET
npm --workspace apps/api run migrate          # applies db/migrations in order
npm run dev:api                               # :4000
npm run dev:web                               # :3000
npm run dev:mobile                            # Expo (adb reverse runs first for Android)
```

Key env vars: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
`GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_MAPBOX_TOKEN`, S3 credentials for image upload,
`ANTHROPIC_API_KEY` for AI listing descriptions.

Stripe isn't needed to boot — search, listings and auth work without it. Checkout needs the
Stripe keys in test mode plus a webhook forwarder:
`stripe listen --forward-to localhost:4000/api/bookings/webhook`. Outside production the API
returns the email-verification deep link in the response instead of sending it, so no mailer
is required to get a usable account.

## Testing

```bash
npm run test:api            # vitest + supertest — the DB is mocked, so SQL and
                            # trigger behaviour aren't covered here
npm run test:mobile         # jest, including the pricing-parity suite
npm run typecheck:mobile
npm run test:web:e2e:local  # Playwright, boots API + web
npm run test:mobile:e2e     # Maestro flows
npm run prepush:check       # full gate: tests, typecheck, lint, builds, web e2e
npm run check:migrations    # migration sanity
```

## Deployment

Push to `main` → GitHub Actions → container build → ECR → Lightsail → migrate → smoke
checks. API served at `https://api.freespace.ie`. Rollback is manual, per
`docs/ops/rollback-playbook.md`. Mobile releases go out through EAS
(`cd apps/mobile && npm run eas:qa` / `eas:prod`). Detail in [DEPLOYMENT.md](DEPLOYMENT.md)
and `docs/ops/`.

## Things that will bite you

- **Pricing is duplicated on purpose.** `apps/mobile/utils/pricing.ts` and
  `apps/web/lib/pricing.ts` exist to render a price before the user commits; the server
  recomputes it and rejects any mismatch. Change them together with the API and both test
  suites, or bookings fail the amount check.
- **The API contract is hand-mirrored.** A new endpoint needs matching changes in
  `apps/web/lib/api.ts` and/or `apps/mobile/api.ts`. There's no codegen.
- **Enum values need a migration before code references them.** `ALTER TYPE ... ADD VALUE`
  ships first, in its own migration.
- **Bookings snapshot their listing.** Title, address, coordinates and amount are frozen at
  confirmation, so listing edits can't rewrite what someone already paid for. Access codes
  and arrival instructions are the deliberate exception and stay live reads.
- **Deep links use two schemes.** `carparking://` (legacy) and `freespace://` are both
  registered; `APP_DEEP_LINK_SCHEME` controls which one the API emits, and stays on the
  legacy value until a build registering the new one is live in both stores.

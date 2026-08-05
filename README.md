# FreeSpace — peer-to-peer parking for Ireland

A host lists a driveway, garage or gated spot → a driver searches a map for a time window
and books it → payment is taken and confirmed by Stripe → the space is held against
double-booking and the host gets paid, with the ~8% platform fee baked into the price the
driver sees. Web live at [freespace.ie](https://freespace.ie); the mobile apps ship through
EAS.

The engineering principle throughout: **the client displays, the server decides, the
database enforces.** Every price the app renders is recomputed server-side and the booking
is rejected on mismatch. Every booking is confirmed by a Stripe webhook, not a client
callback. Capacity is a Postgres trigger, not an `if` statement. Each layer assumes the one
above it is wrong.

[AGENTS.md](AGENTS.md) holds the conventions and the invariants that can't be broken;
`docs/ENGINEERING_HANDBOOK.md` is the deep reference behind them.

## Quick start

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

Stripe isn't needed to boot — search, listings and auth all work without it. Checkout
needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in test mode, and a webhook forwarder:
`stripe listen --forward-to localhost:4000/api/bookings/webhook`.

## Try it locally

1. Register on the web app. Outside production the API returns the verification deep link
   in the response instead of emailing it, so no mailer is required to get a usable account
   — booking, hosting and payment routes all sit behind `email_verified`.
2. Create a listing through the host wizard: location, capacity, availability, pricing.
   Suggested prices come from the server's fee schedule, not the client.
3. Search the map for an overlapping time window and book it. Stripe test card
   `4242 4242 4242 4242` completes the payment; the booking flips from `pending` to
   `confirmed` when the forwarded webhook lands, not when the client returns.
4. Worth trying: book the same slot twice past a listing's capacity. The second attempt
   fails on the database trigger with a 409, even if you race it — the route's own
   availability check is a courtesy, not the guarantee.

## Layout

Yarn-workspaces monorepo.

| Path | What |
|---|---|
| `apps/api/` | Express + TypeScript (ESM). Raw `pg` + PostGIS, no ORM — all SQL lives in `src/lib/db.ts`. Zod-validated env that fails the boot on bad config. |
| `apps/web/` | Next.js 15 App Router + Tailwind + Mapbox GL. Search, booking, host wizard, role-gated `/admin`. |
| `apps/mobile/` | Expo SDK 54 / React Native. React Navigation, SecureStore auth, Stripe Payment Sheet, per-environment build lanes via `app.config.js` + EAS profiles. |
| `db/migrations/` | Append-only numbered SQL, applied in filename order in one transaction per file, tracked in `schema_migrations`. |
| `AGENTS.md` | Conventions, invariants, and the landmines worth knowing before changing anything. |

The API contract is hand-mirrored into both clients — a new endpoint needs matching changes
in `apps/web/lib/api.ts` and/or `apps/mobile/api.ts`. There's no codegen; that's a
deliberate trade-off noted below.

## Testing and deploying

```bash
npm run test:api            # vitest + supertest — note the DB is mocked
npm run test:mobile         # jest, including the pricing-parity suite
npm run typecheck:mobile
npm run test:web:e2e:local  # Playwright, boots API + web
npm run test:mobile:e2e     # Maestro flows
npm run prepush:check       # the full gate: tests, typecheck, lint, builds, web e2e
```

Push to `main` and GitHub Actions builds containers, pushes to ECR, deploys to Lightsail,
runs migrations and smoke-checks production. Rollback is manual and documented in
`docs/ops/rollback-playbook.md`. Mobile releases go out through EAS
(`cd apps/mobile && npm run eas:qa` / `eas:prod`). Full detail in
[DEPLOYMENT.md](DEPLOYMENT.md) and `docs/ops/`.

## Engineering decisions

The calls that shaped the codebase — each deliberate:

- **Money math exists once, on the server.** The driver price is the parking cost × 1.08
  and the platform fee is gross × 8/108, always in integer cents. Clients recompute it only
  to render a number before the user commits, and the server verifies whatever the client
  sends against its own calculation and rejects a mismatch outright. The duplication in
  `apps/mobile/utils/pricing.ts` is therefore a display convenience that can never be
  authoritative — but it must stay behaviourally identical to the API, with both test
  suites updated together, or every booking fails the amount check.
- **The webhook is the source of truth, and the client confirm is an optimization.** A
  `pending` booking row is written before payment, the Stripe webhook confirms it, and the
  client-side confirm only shortens the wait. Both paths are idempotent and every Stripe
  create carries an idempotency key, because the interesting failures here are the double
  deliveries and the retries, not the happy path.
- **Capacity is enforced in the database.** `check_booking_capacity` raises `P0001`, which
  the API maps to a 409. Route-level availability checks exist purely to fail fast with a
  nicer message; deleting them would be a UX regression, not a correctness one. Two drivers
  racing for the last space is a real scenario, and application-level checks lose that race.
- **A confirmed booking is a contract.** Title, address, coordinates and amount are
  snapshotted onto the booking, so a host editing or archiving a listing can't retroactively
  change what someone already paid for. Access codes and arrival instructions are the
  deliberate exception and stay live reads — a host who changes the gate code needs that to
  reach tonight's driver.
- **No ORM.** Every query is a named, parameterized function in `db.ts` and ownership checks
  live in the SQL `WHERE` clause rather than in a post-fetch `if`. It makes the PostGIS
  distance queries and the transactional booking paths legible, at the cost of a 4,000-line
  file that would be worse in any codebase with more than one person in it.
- **Enum changes need a migration first.** This is written down because the project shipped
  a silent production bug by skipping it: code referenced a `booking_status` of `completed`
  that had never been added to the type, and the sweeps that depended on it failed quietly
  until migration 047 added the value.

## What I'd build next

In the order I'd do it:

1. **Redis, before a second API instance.** Rate limiting and the fraud caches are in
   memory today, which is correct for one process and silently wrong for two. This gates
   horizontal scaling, so it comes first.
2. **Automated host payouts.** Payouts are reconciled manually against Stripe Connect. The
   volume doesn't hurt yet and getting it wrong is expensive, so it stays deliberate until
   the schedule is worth automating.
3. **A generated API contract.** Three hand-mirrored clients is fine at this size and a
   liability at the next one; the fix is generating the client types from the Zod schemas
   that already validate every route.
4. **Real-DB integration tests.** The API suite mocks the database, which means the trigger
   and the SQL — the two places correctness actually lives — are verified by hand and by
   the deployed smoke checks rather than by CI. This is the biggest gap in the test story.
5. **Monthly parking as a real product.** It's marketed and searchable but not bookable;
   the interim is an enquiry CTA, and the real version is recurring Stripe subscriptions.

**Known trade-offs accepted:** Ireland, `Europe/Dublin` and EUR are hard-coded assumptions,
as is +353 phone normalization · a single API process on one Lightsail box with RDS behind
it, deployed from `main` with a manual rollback playbook · listing "deletion" is
`status = 'archived'`, never a delete, so financial history survives · two migrations share
the number `026`, harmless but a lint rule waiting to be written.

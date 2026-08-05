# FreeSpace — Instructions for AI coding agents

FreeSpace (repo `freespace`, domain freespace.ie) is a peer-to-peer parking marketplace for
Ireland. Hosts list private spaces; drivers search a map, book, and pay via Stripe; the platform
takes ~8% baked into the displayed price. Status: pre-public-launch hardening.

**Deep reference:** `docs/ENGINEERING_HANDBOOK.md` — read §20 (AI Context) and §21 (Quick
Reference) before non-trivial work. Reusable task prompts: `docs/AI_PROMPT_LIBRARY.md`.

## Stack & layout

Yarn-workspaces monorepo:

- `apps/api` — Express + TypeScript (ESM), raw `pg` + PostGIS, Zod, Stripe. **No ORM** — every
  SQL query lives in exported functions in `src/lib/db.ts`. App assembled by `createApp()` in
  `src/app.ts`; process wiring + background loops in `src/index.ts`; env validated by Zod in
  `src/env.ts` (boot fails on bad config).
- `apps/web` — Next.js 15 App Router + Tailwind + Mapbox GL. API client: `lib/api.ts`.
- `apps/mobile` — Expo SDK 54 / React Native 0.81 / React 19. React Navigation (one native
  stack over a 4-tab navigator), Context-only state, SecureStore tokens (`auth.tsx`), Stripe
  Payment Sheet. API client: root `api.ts`. Per-env lanes via `app.config.js` + `.env.<env>`
  (local/dev/qa/production; separate bundle ids and URL schemes).
- `db/migrations` — append-only numbered SQL files applied in filename order by
  `apps/api/src/migrate.ts` (one transaction per file, tracked in `schema_migrations`).
- Prod: single AWS Lightsail box (Caddy + web + api containers from ECR) + RDS Postgres,
  eu-west-1. Deploy: push `main` → GitHub Actions → ECR → SSH → compose up → migrate → smoke.
  Rollback is manual per `docs/ops/rollback-playbook.md` (the `rollback-api.yml` workflow
  targets torn-down ECS — do not use it).

## Invariants — violating these is a production incident

1. **Server owns all money math.** Driver price = parking cost × 1.08; platform fee =
   gross × 8/108. Money is always integer cents with a `_cents` suffix. Client-sent amounts
   are verified against the server calculation and rejected on mismatch — never trusted.
2. **Pricing parity.** `apps/mobile/utils/pricing.ts` must behave identically to the API's
   `calculateListingChargeCents` (in `src/routes/bookings.ts`). Change both together, plus both test suites
   (`apps/mobile/test/pricing.test.ts`, `apps/api/tests/`), or every booking 400s with
   "price out of date".
3. **Webhook is truth.** A booking row (status `pending`) is created before payment; the Stripe
   webhook confirms it; client-side confirm is only an optimization. Both paths must stay
   idempotent. Every Stripe create gets an idempotency key. Refund keys:
   `refund:<reason>:<booking>:<intent>`. Never overwrite `bookings.payment_intent_id`;
   top-up charges go in `booking_payments`.
4. **Capacity is enforced by the DB trigger** (`check_booking_capacity`, raises `P0001` →
   HTTP 409). Route-level availability checks are fast-fail conveniences, not safety.
5. **Confirmed bookings are contracts.** Snapshot fields (title/address/coords/amount) are
   frozen; listing edits must not mutate them. Access code + arrival instructions stay live reads.
6. **Enum discipline.** A new `bookings.status` (or any enum) value requires an
   `ALTER TYPE ... ADD VALUE` migration BEFORE code references it. This repo shipped a silent
   production bug (`'completed'` never added) by skipping this.
7. **Middleware order in `app.ts`.** The two Stripe webhook routes are exempt from the JSON body
   parser (raw body for signature verification). Never add body-parsing/auth middleware ahead
   of that exemption.
8. **Listing visibility.** "Delete" means `status='archived'`. New listing queries must exclude
   archived AND respect `is_active` (an existing gap here is known debt — don't widen it).
9. **Single API process.** Rate limits and fraud caches are in-memory. Don't design anything
   that assumes shared state across instances without flagging the Redis prerequisite.

## Conventions

- DB snake_case; TypeScript camelCase; API JSON camelCase; timestamps `timestamptz` in the DB,
  ISO strings on the wire. Ireland/`Europe/Dublin`/EUR and +353 phone normalization are
  hard-coded assumptions.
- Routes: one Express router per domain in `src/routes/<domain>.ts`; Zod schema defined adjacent
  to its handler; errors go to the central handler via `next(error)` (Zod→422, Stripe→400,
  else 500). Data access only through `lib/db.ts` functions; parameterized SQL only.
- Ownership checks belong in the SQL `WHERE` clause (`user_id = $n`), not post-fetch. State
  transitions use guarded `UPDATE ... WHERE <old state>` and treat `rowCount` as the outcome.
- Booking/hosting/payments require `email_verified` and a non-suspended account. Call
  `insertEventLog` for anything an operator might need to reconstruct. Rate-limit abusable
  routes per userId.
- New API endpoints must be mirrored in the clients that consume them: `apps/web/lib/api.ts`
  and/or `apps/mobile/api.ts` (the contract is hand-mirrored — keep all three in sync).
- Comments explain **why** (constraint, incident history), never what. Preserve existing
  why-comments verbatim when moving code.

## Mobile UI rules (user-approved design decisions — don't relitigate)

- Compose new UI from `apps/mobile/components/ui/*` (Screen, Card, SectionHeader, TextInput,
  Button, SkeletonBlock) and tokens from `styles/theme.ts`, following `MOBILE_UI_GUIDELINES.md`.
  For discovery/card/detail/booking-flow design decisions specifically, see
  `docs/PARKING_DESIGN_BIBLE.md` — principles translated from TGTG/Airbnb/Apple Maps/Uber for
  this parking marketplace, plus the current token-consistency debt to close over time.
  **Active brand revamp (approved 2026-07-07): `docs/FREESPACE_BRAND_REVAMP.md`** — cream
  ground, deep-green register, brand-moment screens, voice. Where it conflicts with the
  bible or this file, the revamp spec wins.
  Font is Plus Jakarta Sans via the theme's `textStyles`. No new imports of UI Kitten or Paper;
  no hardcoded colors, font sizes, radii, or shadows.
- Profile-section screens use the `components/profileUi.tsx` kit: no boxed cards, icon list
  rows (Too Good To Go style). Background is the app-wide cream ground per
  `docs/FREESPACE_BRAND_REVAMP.md` (superseded the earlier white-background rule 2026-07-07).
- Map guardrails: normal basemap (`mapStyles.ts`), green v30 tailless price pins, no hearts on
  pins, **no auto-search on map move**, no artificial/delayed loaders anywhere. Custom markers
  use the `useMarkerTracksUntilPainted` pattern — never leave `tracksViewChanges` on.
- `enableFreeze(true)` is on: covered screens don't re-render on focus. Screens needing refresh
  after a flow use a refresh param (see HistoryScreen's `refreshToken`), not focus effects.
- Honest loading only: skeletons that mirror layout, no spinners on content, no fake delays.
  No fabricated stats or fake social proof anywhere, including marketing surfaces.

## Commands

```
npm run dev:api            # API on :4000        dev:web  # web on :3000
npm run dev:mobile         # Expo (runs adb reverse tcp:4000 first)
npm run test:api           # vitest + supertest (DB mocked — SQL/trigger bugs won't show here)
npm run test:mobile        # jest
npm run typecheck:mobile   # tsc --noEmit
npm run test:mobile:e2e    # Maestro flows in apps/mobile/.maestro/
npm run test:web:e2e:local # Playwright
npm run prepush:check      # run before pushing
npm run check:migrations   # migration sanity
```

Mobile builds: `cd apps/mobile && npm run eas:qa` / `eas:prod` / `eas:prod:ios` — check
`eas.json` profile consistency first (`APP_ENV`, Stripe key prefix, `ALLOW_TEST_PAYMENTS`);
`env.ts` hard-fails on mismatch. Known launch blocker: the production profile still ships a
**test** Stripe publishable key.

## Known landmines (audited against the code 2026-08-05 — re-verify before relying)

Open:

- **Prod EAS ships a `pk_test` publishable key** (`eas.json`). Less severe than it reads: the
  server serves the live key via `GET /api/config`, so the baked value is a fallback — but a
  prod build that can't reach config falls back to *test* Stripe. Launch blocker.
- **Web auth tokens live in `localStorage`** (`apps/web/components/AuthProvider.tsx`), readable
  by any XSS.
- **Account deletion hard-deletes bookings** (`deleteUserAccount` in `db.ts`), destroying the
  counterparty's financial history along with the user's. Needs an anonymise-and-retain policy
  rather than `DELETE`.
- **No payout cron.** `payout_available_at` is set on the row, but nothing sweeps it — payouts
  are reconciled by hand.
- **Duplicate migration number `026`** (`026_event_log.sql`, `026_scheduled_notifications.sql`).
  Harmless — files apply in filename order — but `check:migrations` doesn't catch it.

Closed since this list was last written:

- `'completed'` was added to `booking_status` by migration `047`. The lesson stands (invariant
  6); the bug doesn't.
- Paused listings appearing in search: `findAvailableSpaces` now filters `is_active`.
- "Change-email compares a raw token against a stored hash" — no change-email flow exists.
  Changing email through the profile update sets `email_verified = false` and clears the
  verification token, which is the correct behaviour.

## Working style

The maintainer is a solo founder. Bias to small reversible steps; state honest risk; design
before code for anything multi-file; say plainly when mocked tests can't verify a change and
real-DB or manual verification is needed. App Store Connect changes are advised only — the
user drives ASC themselves.

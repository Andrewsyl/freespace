# FreeSpace — AI Prompt Library

> Reusable, copy-paste prompts for working on this repository with any capable AI model
> (Claude, GPT, Gemini, or future tools). Written from a full read of the codebase as of
> 2026-07-07. Companion documents: `docs/ENGINEERING_HANDBOOK.md` (deep reference),
> `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` (auto-loaded tool instructions).

**How to use this library**

1. Every prompt is inside a fenced block — copy it verbatim, then fill the `{{PLACEHOLDERS}}`.
2. Each prompt lists a **Context Pack** (defined below). If your AI tool has repo access
   (Claude Code, Cursor, etc.) just name the files; if it's a chat window, paste the files in.
3. Prompts have IDs (`ARCH-1`, `BUG-3`, …) used by the Top-20 list and the cheat sheet at the end.
4. When in doubt, start any session with the **Master Prompt** (§ Master Prompt) — it front-loads
   the invariants that prevent the most expensive mistakes in this codebase.

---

## Context Packs

Reusable file bundles referenced by the prompts. Give the smallest pack that covers the task.

| Pack | Contents | Use for |
|---|---|---|
| **CORE** | `docs/ENGINEERING_HANDBOOK.md` §20 (AI Context) + §21 (Quick Reference); whole handbook if context allows | Any task; the minimum viable briefing |
| **MONEY** | `apps/api/src/routes/bookings.ts`, `apps/api/src/routes/payments.ts`, `apps/api/src/lib/stripe.ts`, `apps/mobile/utils/pricing.ts`, `db/migrations/042–046` | Anything touching pricing, payments, refunds, payouts, bookings |
| **DB** | `db/migrations/` (relevant files), the relevant functions in `apps/api/src/lib/db.ts`, `apps/api/src/migrate.ts` | Schema changes, query work, data-layer bugs |
| **MOBILE-UI** | `apps/mobile/MOBILE_UI_GUIDELINES.md`, `apps/mobile/components/ui/`, `apps/mobile/styles/theme.ts`, `apps/mobile/components/profileUi.tsx`, one existing screen similar to the target | New screens, redesigns, component work |
| **API-SHAPE** | `apps/api/src/app.ts`, `apps/api/src/env.ts`, one existing route file in `apps/api/src/routes/`, `apps/web/lib/api.ts`, `apps/mobile/api.ts` | New endpoints, API contract changes |
| **MAPS** | `apps/mobile/components/MapSection.native.tsx`, `MapPricePin.tsx`, `MapBottomCard.tsx`, `mapStyles.ts`, `apps/web/.../MapView.tsx` | Map features and map performance |
| **DEPLOY** | `deploy/lightsail/`, `.github/workflows/`, `scripts/post-deploy-smoke.mjs`, `docs/ops/rollback-playbook.md`, `docs/LIGHTSAIL_MIGRATION.md` | Deployment, infra, incidents |
| **RELEASE** | `docs/release/` (all), `apps/mobile/eas.json`, `apps/mobile/app.config.js`, `apps/mobile/env.ts` | Store submissions, mobile release lanes |
| **TESTS** | `apps/api/tests/`, `apps/mobile/test/`, `apps/mobile/.maestro/`, the code under test | Test writing and QA |

---

# 1. Architecture

### ARCH-1 — Explain a subsystem

**Use when:** you (or a new AI session) need to understand how a part of the system works before changing it.
**Context:** Pack CORE + the files of the subsystem (or let the tool explore).
**Expected output:** prose explanation + data-flow walkthrough + list of invariants and gotchas.

```text
You are working in the FreeSpace monorepo (P2P parking marketplace: apps/api Express+pg/PostGIS,
apps/web Next 15, apps/mobile Expo 54). Read docs/ENGINEERING_HANDBOOK.md §20–21 first.

Explain the {{SUBSYSTEM, e.g. "booking + payment confirmation flow" / "refresh-token auth" /
"push notification pipeline" / "listing search"}} subsystem.

Cover, in this order:
1. Entry points (routes, screens, webhooks, background loops) with file:line references.
2. The happy-path data flow, step by step, including which DB tables/columns change.
3. Every invariant that must not break (this repo has strict money/booking invariants — check
   handbook §20 "Business rules that must never break" and confirm which apply here).
4. Failure paths: what happens on Stripe failure, network drop, concurrent access, process restart.
5. Known debt/landmines in this area (cross-check handbook §18).
Do NOT propose changes yet. Output as markdown with a mermaid sequence diagram for step 2.
```

### ARCH-2 — Design a new feature (before writing any code)

**Use when:** starting anything bigger than a one-file change.
**Context:** Pack CORE + packs relevant to the feature area.
**Expected output:** a written design you can approve before implementation.

```text
Read docs/ENGINEERING_HANDBOOK.md (at minimum §20–21, §18 Technical Debt, §19 Roadmap).

Design (do not implement yet): {{FEATURE DESCRIPTION}}.

Constraints of this codebase you must design within:
- All SQL lives in apps/api/src/lib/db.ts as exported functions; no ORM; money is integer cents.
- New schema = a NEW numbered file in db/migrations/ (next number after the current max; never
  edit applied migrations; check for duplicate numbers — 026 is already duplicated once).
- API surface is hand-mirrored in three clients (apps/web/lib/api.ts, apps/mobile/api.ts) —
  count that duplication as part of the cost.
- Server owns all pricing/fees; clients only display. Webhooks are the source of truth for
  payment state. Single API process (in-memory rate limits) — no design that needs shared state
  across instances unless you call out the Redis prerequisite.
- Mobile UI must compose from apps/mobile/components/ui/* per MOBILE_UI_GUIDELINES.md.

Deliver:
1. One-paragraph summary of the approach and why.
2. Schema changes (full SQL for the new migration file).
3. New/changed db.ts functions (signatures only), new routes (method, path, Zod shape, auth),
   client changes per app.
4. Edge cases and abuse cases (this is a marketplace with real money).
5. What can ship in a v1 vs. deferred; test plan (unit + which Maestro flow to extend).
6. Open questions for me — max 3, only ones that change the design.
```

### ARCH-3 — Architecture refactor proposal

**Use when:** considering a structural change (split `db.ts`, extract shared pricing package, etc.).
**Context:** Pack CORE + the files in question.

```text
Read docs/ENGINEERING_HANDBOOK.md §18–19. I'm considering this architecture change:
{{CHANGE, e.g. "extract a shared packages/pricing used by api, web, and mobile" / "split
lib/db.ts (4.4k lines) by domain" / "split routes/bookings.ts (2.7k lines)"}}.

Produce a migration plan that a solo founder can execute incrementally:
1. Is it worth it now? Weigh against the launch-blocker list in docs/release/public-launch-checklist.md.
2. Step-by-step plan where EVERY step leaves the repo shippable (green tests, deployable).
3. For each step: files touched, mechanical vs. judgement changes, how to verify (which npm test
   script), estimated size of diff.
4. The single riskiest step and how to de-risk it.
5. What NOT to change while doing this (list the invariants at blast radius).
Keep total plan under {{N, default 6}} steps. If the honest answer is "don't do this yet", say so.
```

### ARCH-4 — Scale to N users

**Use when:** planning for growth or a known traffic spike (e.g. a stadium event).
**Context:** Pack CORE + Pack DEPLOY.

```text
FreeSpace prod = ONE Lightsail box (Caddy + web + api containers) + RDS Postgres/PostGIS,
single API process with in-memory rate limits and fraud caches. Read handbook §12 and §18 M1/H1.

Scenario: {{LOAD, e.g. "10k concurrent users during a Croke Park match day" / "1M registered
users" / "steady 100 bookings/hour"}}.

1. Identify the first FIVE things that break, in order, with the specific code/infra reason
   (e.g. capacity trigger's table lock, in-memory state, single process, RDS size, S3 hot paths).
2. For each: the cheapest fix that survives this scenario, cost in $/mo and days of work.
3. A staged plan: what to do now (< 1 day), before launch marketing, and only-when-metrics-say-so.
   Current infra bill is ~$27/mo — respect that frugality; no Kubernetes answers.
4. What load signal/metric tells me it's time for each stage, and where to see it.
Output as a table per section. Assume solo founder ops.
```

### ARCH-5 — Reduce AWS/infra costs

**Use when:** monthly bill review.
**Context:** Pack DEPLOY + current AWS bill breakdown (paste it).

```text
Here is my current AWS bill breakdown: {{PASTE BILL LINES}}.
Infra: Lightsail box (eu-west-1, freespace-prod), RDS Postgres, S3 uploads bucket, ECR, SNS SMS,
SES; legacy ECS/ALB was torn down 2026-06-15. Read docs/LIGHTSAIL_MIGRATION.md.

For each line item: is it justified, reducible, or deletable? Check specifically for:
- Orphaned resources from the ECS/ALB era (snapshots, EIPs, target groups, old ECR images, logs).
- RDS right-sizing vs. risk (this is the only stateful component — be conservative).
- S3 lifecycle rules for listing-images; ECR image retention policy.
- SNS SMS spend vs. moving verification to email-first.
Give exact CLI commands to investigate each suspicion (read-only commands only), then a
ranked list of actions with $/mo saved and risk level. Flag anything where saving money
threatens the money path or backups — those are off-limits.
```

### ARCH-6 — Improve reliability

**Use when:** hardening before launch or after an incident.
**Context:** Pack CORE + Pack DEPLOY.

```text
Read handbook §18 (Technical Debt) and §14 (Error Handling). Known reliability facts: background
loops only logWarn on failure (M9), no payout cron (H7), rollback workflow targets dead ECS (H4),
webhook side-effects run inline (M3), smoke tests run every 30 min via GH cron.

Produce a reliability improvement plan for {{SCOPE, default "the whole system"}}:
1. Rank the top failure modes by (likelihood × blast radius × silence). "Silent money failures"
   outrank "loud UI failures".
2. For each: detection first (how would I even know?), then prevention. Prefer boring fixes:
   an ops alert, a smoke-test assertion, a DB constraint.
3. Concretely extend scripts/post-deploy-smoke.mjs and the GH cron smoke: list new assertions
   worth adding, with the endpoint and expected response.
4. Define a minimal alerting setup for a solo founder (what pages me vs. what waits for morning).
Deliverable: ordered backlog, each item ≤ 0.5 day, with the file(s) to touch.
```

---

# 2. Feature Development

### FEAT-1 — Build a new mobile screen

**Use when:** adding any screen to the Expo app.
**Context:** Pack MOBILE-UI + `apps/mobile/App.tsx` + `apps/mobile/types.ts` + the most similar existing screen.

```text
Build a new mobile screen: {{SCREEN NAME + PURPOSE}}.

Hard requirements for this repo:
- File: apps/mobile/screens/{{Name}}Screen.tsx. Register it in RootStackParamList (types.ts)
  and the navigator in App.tsx.
- Compose from apps/mobile/components/ui/* (Screen, Card, SectionHeader, TextInput, Button,
  SkeletonBlock) and textStyles/spacing/colors from styles/theme.ts. Do NOT import UI Kitten or
  Paper for new UI, do NOT invent new card radii/shadows/one-off fonts. Font is Plus Jakarta Sans
  via the theme's textStyles, per MOBILE_UI_GUIDELINES.md.
- Profile-section screens use the profileUi kit (components/profileUi.tsx): white background,
  no boxes, icon list rows — Too Good To Go style.
- API calls go through the existing wrappers in apps/mobile/api.ts (add a wrapper if missing;
  never fetch() directly from the screen). Handle loading (skeleton, no artificial delays),
  error (GlobalToast), and empty states.
- Remember freezeOnBlur: covered screens don't re-render on focus — if this screen must refresh
  after a flow completes, use a refresh param like HistoryScreen's refreshToken.
- Respect safe areas; test text scale; hit targets ≥ 44pt.

Before coding, read {{MOST SIMILAR EXISTING SCREEN}} and match its patterns exactly.
Deliver the screen file, the navigation/type changes, and any api.ts addition. Then list what I
should verify by hand in the simulator (3–5 bullet QA script).
```

### FEAT-2 — Add a backend feature (route + data layer)

**Use when:** any new API capability.
**Context:** Pack API-SHAPE + Pack DB (+ MONEY if it touches money).

```text
Add a backend feature to apps/api: {{FEATURE}}.

Follow the house pattern exactly:
1. Data layer: exported async function(s) in apps/api/src/lib/db.ts, parameterized SQL only
   ($1, $2 — never interpolation), snake_case in SQL / camelCase in TS, money as integer cents
   with _cents suffix, timestamptz timestamps. Ownership checks belong in the WHERE clause,
   not post-fetch. State transitions use guarded UPDATE ... WHERE and treat rowCount as the result.
2. Route: apps/api/src/routes/{{domain}}.ts, Zod schema defined adjacent to the handler,
   errors via next(error) to the central handler (Zod→422, Stripe→400, else 500). Auth via the
   existing requireAuth/role middleware; booking/hosting/payment actions require email_verified.
   Rate-limit per route keyed on userId if the action is abusable.
3. If operators might ever need to reconstruct this action, call insertEventLog.
4. Schema change? New numbered file in db/migrations/ — never edit an applied migration.
5. Mirror the endpoint in the clients that need it: apps/web/lib/api.ts and/or apps/mobile/api.ts.
6. Tests in apps/api/tests/ following the existing vitest+supertest style (DB is mocked there —
   note in your summary any behavior that mocks can't verify and needs manual/DB testing).

Deliver: migration (if any), db.ts functions, route, client wrapper(s), tests, and a curl
example per new endpoint.
```

### FEAT-3 — Database migration

**Use when:** any schema change.
**Context:** Pack DB.

```text
Write a database migration for: {{CHANGE}}.

Rules for this repo (apps/api/src/migrate.ts applies db/migrations/*.sql in filename order,
one transaction per file, tracked in schema_migrations):
- New file: db/migrations/{{NNN}}_{{snake_case_name}}.sql where NNN = current max + 1. Check
  `ls db/migrations` for the max AND for duplicate numbers (026 is duplicated — don't add more).
- Idempotent guards where cheap (IF NOT EXISTS / ADD VALUE IF NOT EXISTS).
- CRITICAL: enum changes need explicit ALTER TYPE ... ADD VALUE — this repo shipped a bug where
  code referenced a 'completed' booking status that no migration ever added. If your feature
  introduces a new status/enum value, the migration comes FIRST.
- Consider existing rows: backfill or defaults for NOT NULL additions; write the backfill in the
  same file. Note any statement that takes a heavy lock on bookings/listings (prod is live).
- Indexes: PostGIS columns use GiST; time ranges use tstzrange + GiST; add the index in the
  same migration as the query pattern that needs it.
- Add a top-of-file comment: why this change exists (house style is why-comments).

Also update: the affected functions in lib/db.ts, and state whether npm run check:migrations
passes. If the migration is destructive (DROP/DELETE), stop and show me the plan first.
```

### FEAT-4 — API endpoint design

**Use when:** designing the contract before implementation, especially if mobile + web both consume it.
**Context:** Pack API-SHAPE.

```text
Design (contract only) the API for: {{CAPABILITY}}.

For each endpoint give: method, path (under the existing routers — /api/auth, /api/listings,
/api/bookings, /api/host, /api/reviews, /api/admin, /api/support, /api/notifications, /api/config,
payments under /api), auth requirement, Zod request schema, response JSON shape (camelCase,
cents-suffixed integers for money, ISO strings for timestamps), and error cases with status codes
(409 for booking conflicts per the DB-trigger convention, 422 for validation).

Then: show the exact wrapper function signatures to add to apps/web/lib/api.ts and
apps/mobile/api.ts so all three stay in sync, and flag any place where this contract could drift
from server truth (this repo's #1 contract risk is client-computed money — clients may SEND
amounts only as verification hints, never as authority).
```

### FEAT-5 — React Native component

**Use when:** building a reusable mobile component (not a whole screen).
**Context:** Pack MOBILE-UI + where it will be used.

```text
Build a reusable React Native component: {{COMPONENT + BEHAVIOR}}.
Location: apps/mobile/components/ ({{or components/ui/ if it's a true primitive}}).

Repo conventions: theme tokens from styles/theme.ts only (no hex literals), Plus Jakarta Sans via
textStyles, spacing scale from theme, animations via the shared motion helpers in styles/motion.ts
(and reanimated patterns already used — check PulseDots.tsx for the current idiom), haptics via
expo-haptics for meaningful confirmations only. Props typed with an exported interface. If it
renders in a list, make it memo-safe (stable callbacks, no inline object props at call sites —
show the correct call-site usage too).
Deliver: component, a usage example in the target screen, and a note on any perf consideration
(especially if used inside the map or a FlatList).
```

### FEAT-6 — Maps feature

**Use when:** anything touching the mobile or web map.
**Context:** Pack MAPS.

```text
Implement this map change: {{CHANGE}}.

Non-negotiable guardrails (user-approved design decisions — do not "improve" them):
- Normal basemap styling per mapStyles.ts; green price pins stay green; the v30 "tailless"
  MapPricePin design is final; no hearts on pins; NO auto-search on map move (search fires only
  on explicit user action); no artificially delayed loaders.
- Android marker perf: custom markers must use the useMarkerTracksUntilPainted pattern
  (tracksViewChanges=true only until painted). Never leave tracksViewChanges on.
- Mobile = react-native-maps with Google provider; web = Mapbox GL. Keep pin visual parity.

Deliver the change, then a perf note: marker count impact, re-render triggers you added/avoided,
and how to verify smooth panning on a low-end Android device.
```

### FEAT-7 — Payments feature

**Use when:** anything in the Stripe surface. **Treat as the highest-risk area of the repo.**
**Context:** Pack MONEY + handbook §8.

```text
Implement this payments change: {{CHANGE}}.

Read handbook §8 and §20 first. Invariants you MUST preserve (violating any of these is a
production money incident):
- Server computes all amounts: driver price = parking cost × 1.08; fee = gross × 8/108.
  Client-sent amounts are verified against server calc and rejected on mismatch — never trusted.
- Mobile utils/pricing.ts and API calculateListingChargeCents must produce identical results;
  if you change one, change both AND their tests (apps/mobile/test/pricing.test.ts,
  apps/api/tests/).
- Two payment paths exist: hosted Checkout (web/QR) and PaymentIntent + Payment Sheet (mobile).
  State which path(s) your change affects and keep the other consistent.
- Booking row (pending) is created BEFORE payment; the webhook is the source of truth for
  confirmation; client-side confirm is only an optimization; both must stay idempotent.
- Never overwrite bookings.payment_intent_id; top-ups go in booking_payments.
- Every Stripe create gets an idempotency key; refunds use refund:<reason>:<booking>:<intent>.
- Orphaned payment (paid intent, no booking) → auto-refund + ops alert. Post-payment slot
  conflict → refund + cancel.
- Webhook routes are exempt from the JSON body parser in app.ts (raw body for signature
  verification) — do not add middleware ahead of that exemption.

Deliver: implementation + tests + a manual test script using Stripe test cards, including the
failure cases (declined card, webhook-before-return, double-fire of the webhook).
```

### FEAT-8 — Authentication feature

**Use when:** changing login, tokens, verification, or account lifecycle.
**Context:** `apps/api/src/routes/auth.ts`, `apps/mobile/auth.tsx`, `db/migrations/045_refresh_tokens_per_device.sql`, handbook §7.

```text
Implement this auth change: {{CHANGE}}.

Current design (preserve unless the change is explicitly about it): JWT access 7d HS256 +
rotating per-device refresh tokens 30d (hashed in DB, migration 045); bcrypt passwords;
Google/Apple/Facebook OAuth with email as the cross-provider identity key; email verification
gates booking/hosting/payments; SMS phone verification; password reset invalidates all sessions.
Mobile stores tokens in SecureStore (auth.tsx); web currently uses localStorage (known debt H5 —
do not make it worse).

Requirements: hash any one-time token at rest and compare hashed (there is a live bug where
change-email stores hashed but compares raw — don't replicate it); no user-enumeration responses
(unknown email must respond identically to known); rate-limit anything guessable; log security
events via insertEventLog. Update all three clients if the contract changes.
Deliver implementation + tests + a threat note: what an attacker gains if this feature has a bug.
```

### FEAT-9 — Messaging (new subsystem)

**Use when:** building driver↔host messaging (currently doesn't exist; roadmap item #2).
**Context:** Pack CORE + Pack API-SHAPE + Pack DB.

```text
Design and implement v1 of in-app driver↔host messaging for FreeSpace. There is currently NO
messaging — support tickets are the only channel. Scope it like a solo founder:

v1 = booking-scoped threads only (a thread exists per booking, participants = driver + host),
plain text, push notification on new message via the existing Expo push pipeline
(routes/notifications.ts + scheduled-notification processor), unread badge count.
Explicitly out of scope: media, typing indicators, pre-booking chat (spam/abuse surface), read
receipts.

Follow ARCH-2's deliverable format: migration SQL, db.ts functions, routes with Zod, mobile
screens composed from the ui kit, web later. Include: abuse controls (rate limit per user,
block on suspended accounts, phone/email regex nudge to keep contact in-app), retention position,
and how admin support can view a thread. Ship plan in 2 PRs max.
```

### FEAT-10 — Notifications

**Use when:** adding or changing push/email/SMS notifications.
**Context:** `apps/api/src/routes/notifications.ts`, the scheduled-notification processor in `apps/api/src/index.ts`, handbook §9.

```text
Add/modify a notification: {{TRIGGER → MESSAGE → DEEP LINK}}.

Repo pipeline: rows in the scheduled-notifications table processed by a 60s loop in index.ts;
Expo push via expo-server-sdk; email via SES SMTP with Resend fallback; SMS via SNS (expensive —
justify any SMS). Deep links use the carparking:// scheme (carparking-dev:// in dev) and must be
registered in the mobile linking config; booking_ending category has an "Extend +" action.

Requirements: idempotent scheduling (no dupes if the trigger fires twice), respect the per-user
push caps, deep link must land somewhere sensible when the target no longer exists (canceled
booking), copy in the house voice (plain, human, no exclamation marks). Known debt: push receipts
are never checked (M2) — if you're in this code anyway, fixing receipt handling is in scope.
Deliver: scheduling code, processor handling, mobile deep-link handling, and the exact copy for
me to approve before you finalize.
```

---

# 3. Bug Fixing

### BUG-1 — Root cause analysis (the default debugging prompt)

**Use when:** any bug where the cause isn't obvious. Use before writing a fix.
**Context:** Pack CORE + every observable (error text, logs, screenshot, repro steps).

```text
Bug report: {{SYMPTOM, exact error text, where seen (mobile/web/api/admin), when it started,
repro steps if known}}.

Do a root-cause analysis BEFORE proposing any fix:
1. Reproduce or trace the exact code path (file:line) from trigger to symptom.
2. State the root cause as a falsifiable claim, and the evidence for it. If you can't reach one
   cause, give the top 2 hypotheses and the single cheapest experiment that distinguishes them
   (a log line, a SQL query against prod read-only, a curl).
3. Check the known-landmine list first — many "new" bugs here are these: 'completed' missing from
   booking_status enum; disabled/paused listings still searchable; change-email verification
   compares raw vs hashed token; in-memory rate limits reset on deploy; freezeOnBlur eating
   focus refreshes; pricing drift between utils/pricing.ts and the API.
4. Blast radius: what else does this root cause break that nobody has noticed yet?
5. Only then: the minimal fix, and the test that would have caught it.
If the fix touches money or bookings, list which §20 invariants you re-verified.
```

### BUG-2 — Mobile crash debugging

**Use when:** a crash from Sentry, TestFlight feedback, or a red screen.
**Context:** the full stack trace / Sentry event JSON + the implicated files.

```text
Mobile crash. Stack trace / Sentry event:
{{PASTE FULL TRACE}}
Device/OS: {{e.g. iPhone 12, iOS 18 / Pixel 6, Android 15}}. App env lane: {{local/dev/qa/production}}.
What the user was doing: {{STEPS}}.

Environment facts: Expo SDK 54, RN 0.81, React 19, Hermes, new-arch per Expo 54 defaults,
react-native-maps, Stripe payment sheet, Sentry RN 8.x. Known crash-prone spots historically:
Metro/forwardRef parsing (fixed in aa41e89), map marker churn, keyboard/form interactions.

1. Decode the trace: which frame is ours vs. library, and what state must have held for it to throw.
2. Distinguish: JS error vs native crash vs OOM — the fix strategy differs; say which this is.
3. Root cause per BUG-1 discipline.
4. Minimal fix + defensive guard ONLY if the invalid state is genuinely reachable (no blanket
   try/catch that hides the next bug).
5. How to reproduce it in the simulator, and whether a Maestro step in .maestro/ can regression-
   guard it.
```

### BUG-3 — Race conditions & concurrency

**Use when:** double bookings, duplicate charges, state machines going backwards, "works alone, breaks under load".
**Context:** Pack MONEY or the relevant route + db.ts functions.

```text
Suspected race condition: {{SYMPTOM, e.g. "two bookings confirmed for last capacity slot" /
"duplicate refund" / "booking flipped canceled→confirmed"}}.

Concurrency model of this repo (verify my claims against the code as you go):
- Overlap/capacity is enforced by the check_booking_capacity DB trigger (raises P0001, mapped to
  HTTP 409); route-level availability checks are only fast-fail pre-checks and provide NO safety.
- The trigger currently locks the whole bookings table per insert (known H1) — races here are
  more likely a symptom of code paths that BYPASS the trigger than of the trigger failing.
- State transitions must be guarded UPDATE ... WHERE old-state, using rowCount as the outcome.
  Webhook + client-confirm can both fire; both must be idempotent.
- Single API process, but background loops (stale-pending sweeper, notification processor) run
  concurrently with requests in the same process.

1. Draw the interleaving that produces the symptom (two timelines, step by step).
2. Identify the unguarded window (missing WHERE guard, check-then-act gap, non-idempotent
   webhook branch, sweeper racing a live payment).
3. Fix at the strongest available layer: DB constraint/trigger > guarded UPDATE > app logic.
4. Write a test that provokes the race (concurrent supertest calls or direct db-layer calls) —
   if the vitest mocks can't express it, say so and give me the manual/psql reproduction instead.
```

### BUG-4 — Async / promise bugs

**Use when:** unhandled rejections, hangs, out-of-order UI state, "sometimes it just doesn't load".
**Context:** the implicated files.

```text
Async bug: {{SYMPTOM}} in {{FILE(S)}}.

Audit the code path for this repo's recurring async patterns:
- API: fire-and-forget awaits are ONLY acceptable for emails/pushes — never on the money path.
  Check whether an error in a Promise chain escapes next(error) and dies as an unhandled rejection.
- Webhook handler awaits side-effects inline (known M3) — partial failure leaves ambiguous state;
  check if this bug is that.
- Mobile: setState after unmount, effects missing cleanup, stale closure over auth/session state
  in auth.tsx consumers, response races when a user retypes a search (is the older response
  clobbering the newer?), and freezeOnBlur suppressing focus-driven refetches.
Walk the actual execution order for the failing scenario, name the exact line where ordering or
error propagation breaks, fix it minimally, and add the missing cancellation/sequencing guard
(AbortController or request-id comparison for search-type races).
```

### BUG-5 — Rendering bugs (mobile & web)

**Use when:** visual glitches, layout jumps, flicker, wrong data on screen.
**Context:** screenshot/video + the component files.

```text
Rendering bug: {{DESCRIPTION + attach screenshot}}. Screen: {{SCREEN}}. Platform: {{iOS/Android/web}}.

Check in this order (repo-specific likely causes first):
1. Stale data via freezeOnBlur — screen not re-rendering when uncovered; needs a refresh param.
2. List identity: FlatList keyExtractor/memo issues causing recycled row visuals.
3. Map markers: tracksViewChanges left on, or marker re-mount churn from unstable keys.
4. Theme drift: hardcoded values fighting styles/theme.ts tokens; safe-area insets; Android
   vs iOS text baseline/line-height differences with Plus Jakarta Sans.
5. Web only: hydration mismatch in the Next App Router page (server vs client rendering of
   dates — remember Europe/Dublin formatting), Tailwind class conflicts.
Find the actual cause (don't fix blind), show a before/after explanation, keep the diff minimal,
and state how to eyeball-verify on both platforms.
```

### BUG-6 — Network failures & offline behavior

**Use when:** timeouts, spinners forever, errors on flaky connections.
**Context:** `apps/mobile/api.ts` or `apps/web/lib/api.ts` + affected screen.

```text
Network failure symptom: {{SYMPTOM}} under {{CONDITION, e.g. "slow 3G", "API restart mid-request",
"airplane mode toggle"}}.

Trace the request through the client wrapper (mobile api.ts / web lib/api.ts): timeout config,
retry behavior, error shape surfaced to the screen, and token-refresh interplay (does a 401 mid-
flight trigger the refresh flow, and can two parallel 401s double-rotate the refresh token? —
rotation is per-device, migration 045, so a double-rotation kills the session).
Then fix so that: user sees an honest error state (house rule: no fake/delayed loaders), retry is
safe (idempotent or guarded — NEVER auto-retry a payment POST), and a recovered connection
resumes cleanly. List every screen state (loading/error/empty/success) you verified.
```

### BUG-7 — Production incident (live)

**Use when:** prod is broken right now. Optimized for speed and safe actions.
**Context:** Pack DEPLOY + symptoms. Have SSH access ready.

```text
PRODUCTION INCIDENT. Symptom: {{WHAT'S BROKEN, since when, who reported}}.

Infra: single Lightsail box 3.248.117.93 (Caddy + web + api containers via docker compose,
deploy/lightsail/compose.prod.yml) + RDS. Rollback playbook: docs/ops/rollback-playbook.md.
NOTE: the GH rollback-api.yml workflow targets the torn-down ECS — do NOT use it; rollback is
manual per the playbook.

Work in this strict order and tell me exactly what to run at each step (I execute, you interpret):
1. TRIAGE (read-only): GET /health, docker compose ps, last 200 api container log lines,
   RDS reachability, Stripe status page, when the last deploy landed (gh run list).
2. CLASSIFY: bad deploy / infra / dependency (Stripe, Maps) / data. State confidence.
3. MITIGATE with the smallest reversible action: restart container < repin previous ECR image
   < config change. Anything touching the DB or Stripe data requires my explicit go.
4. VERIFY: /health + one real search + scripts/post-deploy-smoke.mjs expectations.
5. Afterwards: 5-line incident note (timeline, cause, fix, detection gap, follow-up) and which
   smoke assertion or alert would have caught it earlier.
Do not propose refactors mid-incident.
```

### BUG-8 — Memory leaks

**Use when:** app slows over time, OOM crashes, API RSS creeping.
**Context:** the suspect area + any profiler output.

```text
Suspected memory leak in {{mobile app / API process}}. Evidence: {{SYMPTOMS/METRICS}}.

Repo-specific suspects to check first:
- API: the in-memory rate-limit and fraud maps (are they swept? bounded?), notification/booking
  sweeper closures, PostHog/Sentry buffering, pg pool config in lib/db.ts.
- Mobile: listeners not removed on unmount (map region, keyboard, deep-link, notification
  subscriptions in App.tsx), navigation stacking (does the flow push screens infinitely rather
  than replace?), image memory on listing galleries, timers in animated components (PulseDots).
Give me: (1) the measurement plan first — exact steps to confirm and localize the leak (Xcode
Instruments / Android Profiler / node --inspect heap snapshots) so we don't fix folklore;
(2) after localization, the fix with the cleanup path shown explicitly.
```

---

# 4. Code Review

### REV-1 — PR / diff review (general)

**Use when:** before merging any non-trivial branch.
**Context:** the full diff (`git diff main...HEAD`) + Pack CORE.

```text
Review this diff for the FreeSpace repo. Read docs/ENGINEERING_HANDBOOK.md §20 first — review
against THOSE invariants, not generic best practice.

{{PASTE DIFF or point at the branch}}

Report findings ranked by severity, each with file:line, the concrete failure scenario
(inputs/state → wrong outcome), and the minimal fix. Check specifically:
1. Money: any client-derived amount trusted? pricing parity (utils/pricing.ts vs API) broken?
   idempotency keys missing? payment_intent_id overwritten?
2. Bookings: status values that need enum migrations; snapshot fields mutated after confirm;
   capacity logic moved out of the DB trigger's protection.
3. SQL: injection (interpolation vs $n), ownership checks post-fetch instead of in WHERE,
   archived/is_active filters missing from new listing queries.
4. API contract: response shape changed without updating web lib/api.ts AND mobile api.ts.
5. Middleware order in app.ts (webhook raw-body exemption), new unauthenticated routes.
6. Mobile: new UI bypassing components/ui/*, hardcoded styles, freezeOnBlur refresh traps.
7. Tests: does the diff change behavior without changing a test?
End with: verdict (merge / fix-first / redesign) and the 1–3 things I must manually verify.
```

### REV-2 — Security review of a change

**Use when:** the diff touches auth, money, admin, uploads, or user input.
**Context:** the diff + the full files it modifies.

```text
Security-review this diff (not a general audit — just this change): {{DIFF}}.

Threat model: public marketplace with real money; attackers include hostile users (fake hosts,
card testers, scrapers), compromised accounts, and XSS-injected browsers (web tokens are in
localStorage — assume XSS = full account until H5 is fixed).

For each changed surface ask: Who can call this? (authn) — Can they only reach their own rows?
(ownership in SQL WHERE) — Can input escape its type/bounds? (Zod completeness: .strict()?,
max lengths?, numeric bounds?) — Can it be replayed or raced for profit? — Does it leak
existence/enumeration info? — Does it log secrets or PII? — Can it move money or change a
booking contract in a way the webhook/trigger layer wouldn't catch?
Report only exploitable findings with a concrete attack script (curl-level), ranked. If clean,
say clean — no CYA filler findings.
```

### REV-3 — Performance review of a change

```text
Performance-review this diff: {{DIFF}}.
Focus on this repo's real constraints: single API process; RDS is small; hot paths are search
(PostGIS ST_DWithin + availability ranges), listing detail, and booking creation (holds the
bookings table lock via trigger). Mobile hot paths: map pan/zoom with markers, search results list.
Flag: N+1 queries added to db.ts, missing index for a new WHERE/ORDER BY (give the CREATE INDEX),
work moved inside the capacity-trigger window, sync work added to the webhook handler, unmemoized
props into list rows or markers, new bridge-crossing per-frame work. For each: measured-or-
estimated cost, and the fix. Skip anything below ~10ms/request or invisible at 60fps.
```

### REV-4 — Readability / maintainability review

```text
Review this diff purely for future-maintainer cost: {{DIFF}}.
House style: comments explain WHY (constraints, incident history) not what; money in _cents ints;
functions in db.ts do one query concern; Zod schemas adjacent to handlers; screens compose from
ui primitives. Flag: names that lie, cleverness that needs a comment but lacks one, comments
that just narrate code (delete them), logic that belongs in db.ts but sits in a route (or vice
versa), copies of logic that already exists (search the repo before assuming novelty — pricing,
date math, and formatting helpers already exist in utils/). Suggest concrete renames/moves, not
platitudes.
```

### REV-5 — Accessibility review (mobile)

```text
Accessibility-review {{SCREEN(S)}} in apps/mobile.
Check concretely, with file:line fixes:
- Every touchable: accessibilityRole + accessibilityLabel (esp. icon-only buttons in profileUi
  rows, map pins, heart/favorite toggles); hit target ≥ 44pt.
- Dynamic type: does layout survive 1.3× font scale? (theme textStyles use fixed sizes — flag
  truncation points.)
- Contrast: green brand on white, meta-gray text — check against WCAG AA, cite the failing pairs.
- Screen reader flow: logical order on ListingScreen and the booking flow; announcements for
  async results (search finished, booking confirmed); Payment Sheet is Stripe's — note the
  boundary.
- Reduced motion: gate decorative animation (PulseDots, motion.ts transitions) on the OS setting.
Output a checklist table: issue / severity / fix / file:line.
```

### REV-6 — App Store / Play Store readiness review

**Use when:** before a store submission. Pairs with `DEPLOY-1`.
**Context:** Pack RELEASE.

```text
Review store-submission readiness for {{iOS App Store / Google Play}} against this repo's actual
state. Read docs/release/* (public-launch-checklist, app-store-metadata, mobile-permissions-copy,
screenshot-checklist), eas.json, app.config.js.

Known blockers to verify current status of (don't assume fixed): production EAS profile ships a
TEST Stripe publishable key + ALLOW_TEST_PAYMENTS=true; Apple Sign-In requirement (app has
Google/Facebook login → Apple mandates Sign in with Apple on iOS); account deletion flow (store
requirement — and this repo's delete has known financial-record problems, H2); iOS has never
been submitted.

Then check: permission strings vs actual usage (location, camera/photos, notifications) against
mobile-permissions-copy.md; privacy manifest / data-safety form answers derivable from the
actual SDK list (Sentry, PostHog, Stripe, Google Maps, FB/Google sign-in); age rating; export
compliance; screenshot set vs checklist; version/build number strategy per release-discipline.md.
Output: BLOCKER / SHOULD-FIX / FINE table with evidence (file or config line) per row. I control
App Store Connect manually — give me instructions, don't attempt API changes.
```

---

# 5. Refactoring

### REF-1 — Large refactor, incremental plan

```text
Refactor goal: {{GOAL, e.g. "split apps/api/src/lib/db.ts (4.4k lines) into per-domain modules"}}.
Rules: every step ships independently (tests green, deployable); no behavior change unless
explicitly listed; steps ≤ ~300 lines of diff each; each step names its verification command
(npm run test:api / typecheck:mobile / test:mobile).
Deliver the step list first for my approval. THEN execute step 1 only. After each step, stop and
report: diff summary, tests run, anything unexpected found (this repo hides incident history in
comments — preserve every why-comment verbatim when moving code).
```

### REF-2 — Component / screen cleanup

```text
Clean up {{FILE, e.g. a mobile screen}} without changing behavior or visuals.
Targets: dead styles, duplicated JSX blocks → extracted local components, one-off styling →
theme tokens/ui primitives (per MOBILE_UI_GUIDELINES.md structure), effects that should be
event handlers, prop drilling that an existing context already solves (Auth/Favorites).
Do NOT: change visual output (I will diff screenshots), add new abstractions used once, convert
to a different state library. After: file line-count before/after and a list of anything you
found but deliberately left (with why).
```

### REF-3 — Remove duplication

```text
Find and consolidate duplication in {{SCOPE, e.g. "date/time formatting across all three apps" /
"the three API client wrappers' error handling"}}.
Process: inventory every copy first (file:line + how they differ — the differences are often
load-bearing in this repo, e.g. mobile pricing intentionally mirrors server pricing). Classify:
true duplicate / intentional mirror (must stay in sync but separate — document the pairing
instead) / false friend (looks similar, isn't). Only consolidate true duplicates. For intentional
mirrors, add a header comment in BOTH files pointing at each other and the test that guards parity.
```

### REF-4 — Improve testability

```text
Make {{MODULE}} testable without changing its behavior.
Current test reality: apps/api tests mock the DB layer (vitest+supertest); there is NO real-
Postgres integration tier (known gap M10 — root enabler of the worst shipped bugs). Mobile has
jest unit tests + Maestro e2e.
Prefer: extracting pure logic (pricing/date/state-transition decisions) into plain functions
away from I/O, over adding mocks. If the module's risk is IN the SQL (most of db.ts), say
plainly that mocks add false confidence and specify the docker-compose Postgres integration
test instead (schema from db/migrations, seed minimal rows, exercise the real trigger paths).
Deliver: refactor + the new tests + what the tests still cannot catch.
```

### REF-5 — Simplify architecture (kill drift debris)

```text
Housekeeping sweep of {{AREA, default "deployment configs and dead code"}}.
Known debris list (verify each is still present before acting): legacy deploy configs
(render.yaml, amplify.yml, Procfile, infra/ecs/, docs/deploy/ecs-fargate-api.md) vs. live
Lightsail path; rollback-api.yml pointing at dead ECS; dead getPresignedUploadUrl PUT variant;
disputes/refunds dead tables; three mobile UI kits (UI Kitten + Paper + custom — new code uses
custom only); committed build artifacts and screenshots at repo root; .idea/.
For each: confirm dead (show the evidence — no references, no CI usage), then move to
docs/legacy/ or delete. Anything ambiguous goes in a "needs Andrew's confirmation" list, not
the diff. One commit per category so I can revert selectively.
```

---

# 6. Performance

### PERF-1 — Mobile startup time

```text
Optimize cold-start time of the Expo app. Current wiring: index.js → App.tsx with provider stack
ErrorBoundary → SafeArea → StripeProvider (fetches /api/config with baked fallback) →
AuthProvider → Favorites → GlobalLoading → GlobalToast; Plus Jakarta Sans font loading;
enableFreeze(true).
1. Measure first: give me the exact steps to profile TTI on a real device (both platforms) so we
   have a before number.
2. Audit: what blocks first paint? (font loading strategy, /api/config await vs fallback race,
   auth token restore from SecureStore, any sync AsyncStorage reads, eager screen imports vs
   lazy, Sentry/PostHog init order.)
3. Propose changes ranked by ms-saved-per-risk. No UX tricks that fake speed (house rule).
4. After implementing, re-measure and report before/after.
```

### PERF-2 — Rendering / scroll / map performance

```text
Fix rendering performance in {{SCREEN, e.g. SearchScreen map + results}}.
Repo-specific checklist: marker tracksViewChanges discipline (useMarkerTracksUntilPainted);
stable keys and memoized rows in results lists; no inline closures/objects passed to list rows
or markers; region-change handlers debounced without adding auto-search (guardrail: search only
fires on explicit action); animations on the UI thread (reanimated) not JS; image sizing
(listing images are full-size S3 URLs — flag if a thumbnail pipeline is the real fix).
Profile with React DevTools profiler / Perf monitor first, name the actual hot component, fix
that. Report re-render counts before/after for the interaction {{INTERACTION}}.
```

### PERF-3 — Battery & background usage

```text
Audit the mobile app for battery drain. Check: location subscription lifecycle (is watchPosition
ever left running after leaving Search?), map running under a pushed screen (enableFreeze should
handle it — verify), timers/animations running while backgrounded (PulseDots, motion loops),
push token refresh frequency, any polling intervals in screens. For each finding: the lifecycle
gap (file:line), fix, and how to verify with Xcode Energy Log / Android Battery Historian.
```

### PERF-4 — API & database optimization

```text
Optimize {{ENDPOINT or QUERY, e.g. "GET /api/listings search"}}.
Method: (1) get the real query from lib/db.ts; (2) EXPLAIN (ANALYZE, BUFFERS) it against a
realistic dataset — give me the psql commands and a seed approach since local data is thin;
(3) check index coverage: PostGIS GiST on location, GiST on availability tstzranges, btree on
the new predicates; (4) only then rewrite. Known patterns worth checking: availability-overlap
subqueries that could be LATERAL joins; COUNT over bookings for capacity when the trigger
already guards writes; missing LIMIT on admin list endpoints.
Constraint: RDS is small and shared with the money path — an index build or rewrite must state
its lock impact. Deliver: before/after EXPLAIN output + the migration file for any new index.
```

### PERF-5 — Bundle & build size

```text
Reduce {{mobile app size / web bundle size}}.
Mobile: npx expo-doctor + source-map-explorer on the release bundle; suspects: three UI kits
(UI Kitten + eva + Paper alongside the custom kit — measure what tree-shakes and what doesn't),
unused expo-* packages, Plus Jakarta Sans weights actually used vs shipped, image assets.
Web: next build output + @next/bundle-analyzer; suspects: framer-motion and recharts imported
at root vs dynamic, Mapbox GL loaded on non-map pages, moment-style date libs.
Report: top 10 contributors with KB, which are safely removable now vs need the UI-kit
consolidation first, then implement the safe ones.
```

### PERF-6 — Network optimization

```text
Reduce network chatter for {{FLOW, e.g. "search → open listing → book"}}.
Trace every request the flow makes (list them: endpoint, size, blocking?). Look for: refetching
what the previous screen already had (pass params/snapshot instead — the listing→booking flow
already uses snapshot data, follow that pattern), missing HTTP caching on static-ish responses
(/api/config, listing nearby JSONB), image loading without size hints, serial awaits that could
be parallel. Keep the server the source of truth for anything bookable/priced — do NOT cache
availability or prices client-side beyond the screen's lifetime.
```

---

# 7. Security

### SEC-1 — Full OWASP-style audit

**Use when:** periodic (quarterly) or pre-launch. Long-running task — run with repo access.
**Context:** repo access + handbook §13 + §18.

```text
Perform a security audit of the FreeSpace API and web app, OWASP Top 10 as the frame but
prioritized by THIS system's threat model (real money, marketplace, solo operator).
Ground rules: verified findings only — for each, show the vulnerable code (file:line), a
concrete attack (curl or steps), impact, and the fix. No theoretical/informational padding.
Known open items to re-verify rather than rediscover: web tokens in localStorage (H5);
moderated/paused listings still searchable (H3); /request-verification email enumeration (M8);
account deletion destroying financial records (H2); committed Google Maps key in eas.json.
Areas to cover beyond those: authz on every /api/admin route; IDOR sweep across booking/listing/
review/support IDs; upload paths (presigned POST conditions, content-type spoofing); webhook
signature handling; rate-limit coverage vs. bypass; CSRF given the token+origin scheme;
dependency audit (npm audit + anything pinned old).
Output: findings table ranked CRITICAL→LOW, then a fix plan sized in days.
```

### SEC-2 — Authentication deep review

```text
Audit the auth system end to end: apps/api/src/routes/auth.ts, apps/mobile/auth.tsx, web login,
migration 045, handbook §7. For each flow (register, login, OAuth×3, email verify, change email,
phone verify, password reset, refresh rotation, logout, delete account) verify: token
generation/entropy/expiry/storage/comparison (hashed at rest? constant-time?), session
invalidation completeness, enumeration resistance, rate limiting, and cross-provider account-
linking logic (email is the identity key — what happens on a Google login whose email matches an
unverified password account?). Produce: per-flow verdict table + exploit narrative for anything
broken. The change-email hash-vs-raw comparison bug (H6) is known — verify current state and
include the fix if still present.
```

### SEC-3 — Authorization / IDOR sweep

```text
Do a systematic authorization sweep of every route in apps/api/src/routes/.
For each endpoint output a row: path | authn required? | role required? | object ownership
enforced WHERE? (quote the SQL clause from db.ts) | verdict.
The house pattern is ownership in the SQL WHERE (user_id = $n), not post-fetch checks — flag
any post-fetch check as fragile and any missing check as a finding with a concrete cross-user
attack (user A's token, user B's resource id). Pay extra attention to: host endpoints
(bookings on MY listing vs any listing), admin sub-resources, review posting (must have a
completed booking — note the 'completed' enum landmine), support ticket access, and the QR
guest portal (/qa/[id] is intentionally unauthenticated — verify what it can reach).
```

### SEC-4 — Payment security review

```text
Audit the payment surface for financial attack vectors. Files: routes/payments.ts,
routes/bookings.ts, lib/stripe.ts, both webhook handlers, booking_payments (043),
stripe_customer_id (046). Attacks to attempt on paper: pay less than price (amount tampering on
every path — Checkout, PaymentIntent, extensions/top-ups, promo application); pay once book
twice (idempotency and replay of webhook events — is event id deduped?); refund farming (book→
cancel loops, extension-then-refund interplay — extension refunds are a known weak area from the
launch audit); promo abuse (stacking, reuse across accounts, floor bypass below 50c); currency/
rounding exploitation at the 8% fee math boundaries; card testing (velocity limits — note
in-memory limits reset on deploy); Connect payout redirection (who can change payout
destination?). For each: blocked / exploitable / partially-mitigated, with evidence.
```

### SEC-5 — Secrets management

```text
Audit secrets across the repo and infra. Check: git history for committed secrets
(git log -p over .env*, eas.json, app.config.js, deploy/ — the Google Maps key in eas.json is
known); what EXPO_PUBLIC_* / NEXT_PUBLIC_* vars actually ship to clients (list them all and
verify each is truly public-safe); how the Lightsail box receives env (deploy scripts, compose
files — are secrets in the compose file on-disk?); scripts/check-env-sanity.mjs coverage vs the
full env surface in apps/api/src/env.ts; key rotation story (JWT_SECRET rotation = mass logout —
document the procedure; Stripe key rotation; DB password). Output: exposure findings ranked,
then a one-page secrets runbook (where each secret lives, how to rotate it, blast radius).
```

### SEC-6 — Abuse & fraud prevention

```text
Review marketplace abuse defenses. Current state: admin_settings JSONB fraud config
(monitor|warn|enforce modes, blocklists, 5 bookings/€2000 per day caps), per-route rate limits
(in-memory), email_verified gates, suspension checks.
Adversaries: fake hosts (listing scams — collect payment for spaces they don't control),
card testers, review bombers, contact-detail smugglers (moving transactions off-platform),
scrapers, multi-account promo farmers. For each: walk the current defense, find the bypass
(in-memory limits reset on deploy; do limits key on user id only — what about device/IP?),
and propose the next-cheapest control. Distinguish launch-blocking (card testing, listing
scams) from post-launch (scrapers). Include what the admin panel needs to surface for me to
spot each pattern manually — I am the fraud team.
```

### SEC-7 — Privacy / GDPR compliance

```text
Audit GDPR compliance (Irish company, EU users). Map: what personal data is stored where
(users, bookings, phone numbers, vehicle profiles, event_log, PostHog, Sentry, Stripe, S3 images,
SES/SNS logs), lawful basis per category, retention (currently: forever), and the data-subject
rights story: export (nothing exists — spec the endpoint), deletion (deleteUserAccount hard-
deletes bookings/listings — that both breaks financial-record retention duties AND over-deletes;
spec the correct anonymize-and-retain design), rectification (profile edit coverage).
Check: PostHog/Sentry data scrubbing config, IP storage, consent surface for analytics, privacy
policy claims in apps/web/app/legal vs actual behavior (mismatches are the legal risk).
Output: gap table (requirement | current | gap | fix | effort) + the account-deletion redesign
as a concrete spec since it's also store-review-relevant.
```

---

# 8. UI / UX

### UI-1 — Premium UI review of a screen

**Use when:** a screen works but feels off. This encodes the design bar already agreed for this app.
**Context:** Pack MOBILE-UI + screenshot(s) of the screen.

```text
Review {{SCREEN}} against this app's established design bar: the reference points are Airbnb,
Stripe, Booking.com, and Too Good To Go (the Profile section explicitly copies TGTG's white/
no-boxes/icon-row style). Screenshot attached.

House principles (already agreed — enforce, don't relitigate): no fabricated stats or fake
social proof in-flow; light branded panels over heavy color blocks; human section titles
("Where you'll park", not "Location Details"); floating white cards on slate-50 where the card
language is used; honest loading (skeletons, no artificial delays); Plus Jakarta Sans throughout.

Critique in order: hierarchy (what should the eye hit first — does it?), spacing rhythm against
the theme scale, typography scale misuse, color discipline (is green doing one job?), touch
ergonomics, copy tone. For each issue: severity, the specific fix (token/value level, e.g.
"meta text should be textStyles.meta not 11px custom"), and file:line. End with the 3 changes
with the highest visual ROI.
```

### UI-2 — Design consistency sweep

```text
Sweep {{SCOPE, e.g. "all mobile screens" / "the booking flow"}} for design-system drift.
Mechanically check each screen for: imports from theme/* or UI Kitten/Paper in NEW code (legacy
allowed, new forbidden), hex colors not from styles/theme.ts, fontSize/fontFamily literals,
ad-hoc borderRadius/shadow values, buttons not using the shared variants, custom text inputs.
Output a table: file | violation | current | should-be | effort(S/M/L). Then fix the S items
in one commit. Do not restyle legacy screens wholesale — this is drift-stopping, not a redesign.
```

### UI-3 — Micro-interactions

```text
Add micro-interactions to {{FLOW/SCREEN}}. Constraints: use the shared motion helpers
(styles/motion.ts) and existing reanimated idioms (see PulseDots.tsx); haptics (expo-haptics)
only for meaningful moments (booking confirmed, save/favorite) — never on every tap; every
animation ≤ 250ms with proper easing, interruptible, and gated on reduced-motion; nothing that
delays perceived responsiveness (guardrail: no delayed loaders, ever).
Propose the moment list first (moment → animation → duration → why it earns its place), get my
approval, then implement. TGTG/Airbnb-level restraint: 3 great moments beat 10 busy ones.
```

### UI-4 — Loading, empty & skeleton states

```text
Audit and fix loading/empty states in {{SCOPE}}.
House rules: SkeletonBlock (components/ui) mirroring the real layout — no spinners on content
areas, no artificial delays, no layout jump when content lands (reserve exact heights). Empty
states must be specific and actionable ("No bookings yet — find parking near you" + CTA into
Search), never generic ("Nothing here"). Distinguish: first-load skeleton / refresh (keep stale
content visible) / empty (real zero) / error (BUG-6 territory — honest message + retry).
Deliver: per-screen state inventory table (screen × 4 states: exists? correct?), then implement
the gaps.
```

### UI-5 — Error message & copy review

```text
Audit user-facing error handling in {{SCOPE}}. For every error surface (GlobalToast messages,
inline form errors, full-screen errors, the 409 booking-conflict path, payment failures):
does it say what happened in human words, whether the user's money/booking is safe (CRITICAL for
payment errors — "You have not been charged" when true), and what to do next? Flag: raw error
text/codes reaching users, Zod field errors not mapped to the actual form field, silent
failures (catch → nothing). Payment errors get extra care: the webhook may still confirm after
a client timeout — the copy must not promise a failure the server later contradicts.
Deliver: copy table (situation | current | proposed) for my approval, then implement.
```

### UI-6 — Accessibility fixes

Use REV-5 to find issues; use this to fix a specific screen:

```text
Make {{SCREEN}} accessible to WCAG AA without visual changes: roles/labels on all touchables,
44pt hit targets (hitSlop where the visual must stay small), dynamic-type resilience to 1.3×,
contrast fixes via the nearest passing theme token, screen-reader order and result
announcements, reduced-motion gating. Show the diff and a VoiceOver walkthrough script I can
run in 2 minutes to verify.
```

### UI-7 — Navigation improvements

```text
Review the mobile navigation architecture for {{PAIN POINT, e.g. "too many taps to rebook" /
"back-stack confusion after booking"}}. Current structure: one native stack over a 4-tab bottom
navigator (Discover/Bookings/Saved/Profile), enableFreeze on, deep links for verify-email/
reset-password/bookings/<id>. Analyze the actual flows (count taps for: repeat a booking, contact
support about a booking, edit a listing) and propose changes that respect: tab identity stays
stable, back always means "up one level" not "random", post-payment navigation must replace (not
push) so back can't re-trigger checkout, deep links land correctly cold AND warm. Mock the
proposal as a flow diagram before touching code.
```

---

# 9. Testing

### TEST-1 — Unit tests for a module

```text
Write unit tests for {{MODULE}}.
Conventions: API tests = vitest + supertest in apps/api/tests/ (DB mocked — follow
bookings.test.ts style); mobile = jest in apps/mobile/test/. Test behavior, not implementation:
each test = one scenario named as a sentence ("rejects booking when client amount mismatches
server price"). Priority order for what to test: money math edge cases (cents rounding, the
×1.08 and 8/108 boundaries, min-1-hour, daily-rate capping, months at 30.44d) > state
transitions (guarded updates returning false) > validation rejects > happy path. State
explicitly which behaviors the mocked-DB style CANNOT verify (trigger behavior, SQL correctness)
so we don't mistake green for safe.
```

### TEST-2 — Integration tests (real Postgres)

**Use when:** building the missing DB-integration tier (known gap M10 — high ROI).
**Context:** Pack DB + Pack TESTS + `docker-compose.yml`.

```text
Build a real-Postgres integration test tier for apps/api — the current suite mocks the DB, which
let an enum bug and a search-filter bug ship.
Requirements: docker-compose Postgres+PostGIS service for tests; apply ALL of db/migrations/ via
the real migrate.ts (this alone catches enum/migration drift); minimal seed helpers (user, host,
listing, booking factories); vitest project "integration" runnable via npm run test:api:int,
kept out of the default fast suite.
First test targets (highest risk first): 1) check_booking_capacity trigger — concurrent inserts
into the last capacity slot, expect exactly one success + P0001; 2) every status value the code
writes/queries exists in the enum (regression for the 'completed' bug); 3) search excludes
archived AND is_active=false AND moderated listings (regression for H3); 4) refresh-token
rotation uniqueness (045); 5) booking snapshot immutability after listing edit (042).
Deliver: infra + the five tests + a CI job sketch, and keep total runtime under ~60s.
```

### TEST-3 — End-to-end tests (Maestro / Playwright)

```text
Add an e2e test for {{FLOW}}.
Mobile: Maestro YAML in apps/mobile/.maestro/ (existing: guest-smoke, driver-booking,
host-publish — read them for selectors/conventions; the app has an `e2e` deep-link test-mode for
scenario setup). Web: Playwright via npm run test:web:e2e:local (see scripts/run-web-e2e.sh for
the harness). Rules: test the user-visible outcome, not implementation; use test-mode/test cards
for anything Stripe (never live mode); make it resilient to copy tweaks (prefer testID/semantic
selectors over exact text where the framework allows); keep it under 2 minutes.
Deliver: the test + how to run it locally + what real bug class it would catch.
```

### TEST-4 — Edge case generation

```text
Generate edge cases for {{FEATURE/FUNCTION}} — cases only, no code yet.
Think in this repo's dimensions: time (bookings spanning DST changes in Europe/Dublin, midnight
boundaries, min-duration rounding, far-future dates, end-before-start), money (0-cent edge,
50c promo floor, rounding at ×1.08, max ints), state (every booking status × every action,
webhook arriving twice / late / after cancel), concurrency (same slot, same user double-tap,
sweep racing payment), identity (guest vs verified vs suspended vs deleted-mid-flow),
data (unicode/emoji in titles, 10MB images, listing at exactly (0,0) — the geocode-failure
sentinel), device (offline mid-payment, app killed after charge before confirm).
Rank by (probability × damage), mark which are already covered by existing tests, and hand me
the top 10 as concrete test specs.
```

### TEST-5 — Regression test for a fixed bug

```text
I just fixed this bug: {{BUG + THE FIX DIFF}}.
Write the regression test that FAILS on the pre-fix code and passes now — verify that claim by
reasoning through the old code path explicitly. Put it at the lowest layer that can express the
bug (pure function > route test > integration > Maestro). Name it after the incident
("regression: change-email token compared raw against hashed"). If the bug lives in SQL/trigger
behavior that mocked tests can't express, say so and write it as a TEST-2 integration test
instead — do not write a mock test that would have passed anyway.
```

### TEST-6 — Manual QA checklist

```text
Generate a manual QA checklist for {{RELEASE/CHANGE}}, formatted as a markdown checklist I can
tick on my phone. Structure: (1) the changed flows, step by step with expected outcomes;
(2) the money-path smoke that runs EVERY release regardless of change: search → open listing →
book with test card → see confirmation + push → extend → cancel → verify refund in Stripe
dashboard → host sees correct earnings; (3) the cheap-but-forgotten checks: fresh install +
login, deep link from a push notification, kill-and-restore mid-flow, airplane-mode error
states, both platforms if mobile. Keep it under 25 items; mark the 5 that are release-blocking
if they fail.
```

---

# 10. Product

### PROD-1 — Feature prioritization

```text
Act as a pragmatic product advisor for FreeSpace (pre-launch P2P parking marketplace, Ireland,
solo founder). Candidate work: {{LIST, or default to: monthly subscriptions, messaging,
Apple Sign-In + iOS submission, host calendar, Apple/Google Pay prominence, launch-blocker
fixes from docs/release/public-launch-checklist.md}}.
Score each on: revenue impact (monthly parking is the known biggest lever), launch-blocking?,
effort (use the handbook's estimates where they exist), risk of building the wrong thing, and
what it unblocks. The bar: what gets to first sustained real revenue fastest? Output a sequenced
next-6-weeks plan with one primary goal per week, and an explicit NOT-doing list with reasons.
Challenge me if my candidate list smells like procrastination from launch.
```

### PROD-2 — User onboarding review

```text
Audit the driver first-run experience: WelcomeScreen → OnboardingPermissionsScreen → Search →
first booking. For each step: what does the user see, what do we ask for, what can they do
WITHOUT it? Principles: never ask for permissions before demonstrating value (can they browse
the map before location permission? before an account?); email verification gates booking — is
the gate at the right moment with the right copy?; count taps from install → completed first
booking and propose cuts. Deliver: current funnel map with friction annotations, then the top 3
changes ranked by expected drop-off reduction, with implementation sketches.
```

### PROD-3 — Conversion improvements

```text
Improve conversion for {{FUNNEL STEP, e.g. "listing view → booking started" / "booking started →
paid"}}. First instrument: what PostHog events exist along this funnel today (check analytics
calls in the relevant screens + routes/analytics.ts) and what's missing to even measure it —
spec the missing events. Then hypotheses: for this step list the likely drop reasons grounded in
the actual UI (price surprise at the ×1.08 display? verification wall timing? payment sheet
friction? unclear availability?), and for each a testable change. Constraints: no fake urgency,
no fabricated social proof (house rule), server-truth prices only. Deliver: instrumentation
diff + top 3 experiments with success metrics.
```

### PROD-4 — Marketplace liquidity & growth

```text
Advise on marketplace liquidity for FreeSpace (Dublin launch). Current state: {{N hosts,
M listings, X bookings/week — fill in what you know}}. Work through: which side is the
constraint right now and how to tell from our data (searches with zero results near the
searcher = demand unserved; listings with zero views = supply unwanted); geographic
concentration strategy (own 3 neighborhoods vs thin coverage citywide — stadiums/hospitals/
transit are the stated wedge); chicken-and-egg tactics that fit a solo founder budget (manual
host onboarding, pre-launch supply seeding, event-day activation). Deliver: the ONE metric to
watch weekly, and a 4-week liquidity plan with concrete Dublin-specific actions.
```

### PROD-5 — Host acquisition

```text
Design a host acquisition play for {{TARGET, e.g. "homeowners near Croke Park" / "small
businesses with evening-empty lots"}}. Ground it in the product's real hooks: passive income,
instant payouts story (Connect Express, start+24h), the host wizard already works on web and
mobile, QR walk-up portal lets a host monetize without the driver having the app. Cover: the
pitch (one paragraph, host's-eyes view of earnings for a realistic Dublin space), channel
(door drops / local Facebook groups / estate agents — cost per host estimate), onboarding
friction audit (walk the actual wizard and list where a non-technical homeowner stalls), and
what "white glove" manual onboarding looks like for the first 50. Include the earnings-claim
compliance check: only claims the pricing math actually supports.
```

### PROD-6 — Retention

```text
Design retention improvements for {{drivers / hosts}}. Current retention surface: push
notifications (booking lifecycle + booking_ending "Extend +"), favorites, booking history,
saved payment methods + vehicle profile (rebooking friction is already low — verify).
Drivers: the realistic pattern is episodic (match days, hospital visits, commutes) — design for
reactivation at the next episode (event-aware "parking near X this Saturday?" pushes, rebook-
last-spot shortcut), not daily engagement. Hosts: the retention risk is delisting after slow
weeks — design the "your space earned €X / got Y views" monthly summary email from data we
already have. Spec both with: trigger, channel, copy draft, opt-out, and the event_log/PostHog
data needed to measure whether it works.
```

---

# 11. Marketing

### MKT-1 — App Store Optimization (ASO)

```text
Write App Store listing copy for FreeSpace ({{iOS / Android}}). Read docs/release/
app-store-metadata.md and screenshot-checklist.md first — build on them, don't ignore them.
Product truth to work from: P2P parking, Ireland/Dublin, cheaper than car parks, book by the
hour/day, instant booking, hosts earn from empty driveways. Deliver: app name + subtitle
(30 char limits), keyword field strategy (iOS 100 chars — research-based Irish/parking terms,
no brand-squatting), description (first 3 lines carry everything — they're all most users see),
promotional text, and the screenshot narrative (which 5 screens, what caption each — must match
real UI per the checklist; no fabricated stats, house rule applies to marketing too).
Localize spelling/idiom for Ireland. Flag any claim that needs the product to actually do the
thing first.
```

### MKT-2 — Launch strategy

```text
Design the public launch plan for FreeSpace in Dublin. Hard constraints: solo founder, budget
{{BUDGET, default "near zero"}}, launch blockers must clear first (defer to
docs/release/public-launch-checklist.md as the gate — the plan starts the week after it's green).
Structure: soft-launch phase (existing testers + one neighborhood, success criteria before
widening), the wedge event (pick a real Dublin anchor — Croke Park fixture, hospital zone,
concert — where parking pain peaks and supply is seedable in advance), press/community angles
that don't need budget (Irish tech press, local radio's consumer slots, neighborhood Facebook/
WhatsApp groups, r/Dublin rules-compliant), and the week-by-week checklist for launch month
with owner (me) and hours per item. Include the failure plan: what we do if bookings don't come.
```

### MKT-3 — SEO for the web app

```text
Audit and improve SEO for freespace.ie (Next 15 App Router). Check the actual code: metadata
exports per route, robots.ts and sitemap.ts contents, listing pages (/listing/[id]) — are they
server-rendered with real content for crawlers, structured data (LocalBusiness/Product/Offer
schema for listings — legitimate fields only), Core Web Vitals on mobile.
Strategy layer: the winnable queries are long-tail local ("parking near {{Croke Park/Mater
Hospital/etc}}", "monthly parking Dublin {{area}}") — spec programmatic landing pages for the
top N Dublin POIs backed by real listing data (only where we have supply — an empty-results
landing page is worse than none). Deliver: technical fixes as diffs + the landing-page spec +
a 10-query target list with realistic difficulty.
```

### MKT-4 — Email campaigns

```text
Design the email program. Infrastructure truth: transactional email already flows via SES SMTP
with Resend fallback; there is NO marketing-email infrastructure or consent capture yet — start
by speccing that (consent checkbox + unsubscribe + suppression list = GDPR baseline; where in
the schema it lives).
Then draft the lifecycle emails with subject + body in the house voice (plain, human, no
exclamation marks, no fake urgency): host monthly earnings summary (see PROD-6), driver
post-first-booking ("how was the spot?" → review ask), abandoned first booking (only if consent
allows), pre-event push ("parking near {{event}} books out early" — only when true).
Everything must merge-tag from data we actually have. Deliver drafts for my approval, not sends.
```

### MKT-5 — Referral program

```text
Design a referral program that survives this platform's fraud model. Mechanics: rider on the
existing promo-code system (migration 038, platform-funded discounts, 50c charge floor) —
give-€X-get-€X on FIRST COMPLETED booking only (not signup; note 'completed' status depends on
fixing the enum bug — call that dependency out). Abuse analysis is the core deliverable: self-
referral via multi-account (email+device+payment-method matching), referral-into-refund farming
(credit clawback on refund), host self-dealing (booking their own listing with referred
accounts). For each: the check, where it runs (booking time vs payout time), and what the admin
panel shows me. Then: the numbers (what €X keeps CAC sane at our 8% take — show the math), and
the minimal v1 schema+endpoints.
```

### MKT-6 — Landing page improvements

```text
Review the freespace.ie landing page (apps/web/app/page.tsx) for conversion. Audience split is
the core tension: drivers (find parking NOW — search box front and center) vs hosts (earn money
— secondary path that must still be findable). Evaluate: five-second test (can a stranger say
what this is and who it's for?), hero copy against the real value prop (cheaper/closer/instant),
CTA hierarchy, social proof options that are TRUE at our stage (no fabricated stats — house
rule; "spaces in 12 Dublin neighbourhoods" only if real), mobile experience (most traffic will
be mobile), and page weight (PERF-5 overlaps). Deliver: critique with screenshots referenced →
proposed section-by-section rewrite → implementation diff after my approval of copy.
```

### MKT-7 — Social media

```text
Design a sustainable (≤2 h/week) social presence for FreeSpace. Channels ranked for a Dublin
hyperlocal marketplace: local Facebook groups and Nextdoor-equivalents (where the hosts are),
Instagram (space photos + event-day utility), X/Twitter (Irish tech scene only, not consumers).
Content pillars grounded in the product: event-day parking intel ("playing at Croke Park
Saturday — book before Thursday"), host earnings stories (real, consented, no invented numbers),
neighborhood spotlights. Deliver: 4-week content calendar with actual post drafts (Irish tone,
no growth-hack cringe), repurposing rules (one asset → 3 formats), and what to measure monthly
to decide keep/kill per channel.
```

---

# 12. Documentation

### DOC-1 — Update the Engineering Handbook

```text
Update docs/ENGINEERING_HANDBOOK.md after these changes: {{SUMMARY OR DIFF/COMMIT RANGE}}.
Rules: preserve the handbook's voice and structure (numbered sections, tables, honest
assessments); update EVERY affected section including §18 Technical Debt (mark fixed items
fixed — don't delete, strike through with the fix commit), §20 AI Context (this section is
what other AI sessions read first — it must never go stale), and §21 Quick Reference.
Update the "as of" date and branch/commit line at the top. Show me the diff of the handbook only.
```

### DOC-2 — Explain a subsystem (written doc)

Use ARCH-1 for interactive explanation; this variant produces a durable doc:

```text
Write docs/{{name}}.md explaining the {{SUBSYSTEM}} for a future maintainer (or AI session).
Follow the handbook's style: what it does in one paragraph → data flow with a mermaid diagram →
the invariants (bold the never-break ones) → failure modes → known debt → file map. Every claim
must be verifiable from code with a file:line pointer. Add a link to it from the handbook's
relevant section.
```

### DOC-3 — Generate API docs

```text
Generate API documentation for {{ROUTER(S) or "all of apps/api/src/routes/"}} by reading the
actual route code and Zod schemas (the schemas ARE the contract — transcribe them faithfully,
don't idealize). Per endpoint: method+path, auth (none/user/verified/host-owner/admin), request
schema with constraints, response shape with an example, error cases (401/403/404/409/422/429)
with the real error body shape from the central handler, and rate-limit behavior where present.
Format: docs/API.md, grouped by router, with a table-of-contents. Flag any endpoint where the
web and mobile client wrappers disagree with the server — that list is as valuable as the docs.
```

### DOC-4 — Onboarding doc for a contractor

```text
Write docs/ONBOARDING.md for a contractor doing their first week on {{AREA, e.g. "mobile UI
work" / "API features"}}. Assume: senior developer, zero context on this repo. Content: 30-minute
orientation reading list in order (handbook sections by number, then key files); local setup
that ACTUALLY works (verify the README steps against reality — Postgres+PostGIS, .env from
.env.example, migrations, the three dev servers, adb reverse for mobile); "your first safe
task" suggestions per area; the rules they must not break (distill §20 invariants relevant to
their area); how to get changes reviewed and what the pre-push checks run. Test every command
you include.
```

### DOC-5 — Architecture diagrams

```text
Generate mermaid diagrams for {{SCOPE}}, suitable for embedding in docs/: (1) system context
(clients → Lightsail/Caddy → containers → RDS/S3 → third parties) — the handbook §2 has one,
update rather than duplicate; (2) the booking+payment sequence diagram (both payment paths as
separate diagrams — Checkout vs Payment Sheet — including webhook, sweeper, and failure
branches); (3) booking status state machine (pending/confirmed/canceled/completed with every
transition's trigger and guard — note the enum landmine on 'completed'); (4) ERD of the core
tables from reading db/migrations/. Accuracy over completeness: verify each edge against code
and mark anything uncertain with a ⚠ comment rather than guessing.
```

---

# 13. Deployment

### DEPLOY-1 — Release readiness check

```text
Run a release-readiness check for {{web+api deploy / mobile {{qa/production}} build}}.
Web/API: uncommitted changes, main vs. branch state, npm run prepush:check, test:api, lint:web,
build:web + build:api locally, any pending db/migrations (they auto-apply on deploy — call out
destructive/locking ones per FEAT-3), env sanity (npm run check:env:production).
Mobile: verify:lanes, typecheck:mobile, test:mobile, eas.json profile sanity (APP_ENV / key
prefix / ALLOW_TEST_PAYMENTS consistency — env.ts hard-fails on mismatch but check BEFORE the
40-minute build), version+build number bump per docs/release/release-discipline.md, and the
Stripe key mode for the lane (prod pk_test is the known blocker — check current state).
Output: GO / NO-GO with the blocking items, then the exact command sequence for the release.
```

### DEPLOY-2 — Production deploy checklist (generate once, reuse)

```text
Generate docs/release/DEPLOY_RUNBOOK.md from the actual deploy pipeline: read
.github/workflows/, deploy/lightsail/, scripts/deploy-lightsail-via-ssh.sh,
scripts/post-deploy-smoke.mjs. Document: the automatic path (push main → Actions → ECR → SSH →
compose up → migrate → smoke), what each stage's failure looks like in the Actions log and what
to do, the manual deploy path when Actions is down, how migrations apply and what happens if
one fails mid-transaction, post-deploy verification (smoke script + the 30-min GH cron + manual
money-path check), and rollback (per docs/ops/rollback-playbook.md — repin previous ECR tag;
NOTE the rollback-api.yml workflow is dead/ECS-era, say so prominently). Every command
copy-pasteable and verified against the scripts.
```

### DEPLOY-3 — Rollback planning

```text
Plan the rollback story for {{THIS DEPLOY/CHANGE}}. Answer concretely: is the code rollback
clean (repin previous ECR image per the playbook) or does this deploy include a migration that
the OLD code can't run against? For migrations: this repo rolls FORWARD (no down-migrations) —
if the schema change isn't backward-compatible with the previous image (dropped/renamed column,
new NOT NULL without default, enum value the old code doesn't send but new rows contain),
say NO-SIMPLE-ROLLBACK and write the forward-fix plan instead. Also: what data will the broken
window have written, and how do we reconcile it (esp. bookings/payments — Stripe is the
recovery source of truth). Deliver: rollback decision tree for this specific change, tested
commands, and the point-of-no-return moment identified.
```

### DEPLOY-4 — Monitoring setup

```text
Design pragmatic monitoring for the Lightsail-era infrastructure. Current signals: GET /health,
scripts/post-deploy-smoke.mjs, GH Actions cron smoke every 30 min, Sentry (mobile + API client
errors), PostHog captureException, structured request logs on-box. Known gap: background-loop
failures only logWarn (M9) — that's how a Critical bug ran silent.
Spec, cheapest-first: (1) the loops and money-path anomalies that must ALERT (ops-alert on
sweep failure, orphaned-payment refund events, webhook signature failures, payout transfer
failures) and the delivery channel that actually reaches me (email → phone push — I already
have Expo push infrastructure; consider an admin-app alert path); (2) uptime check beyond GH
cron (free tier external pinger) with escalation; (3) disk/memory on the box (docker + logs
fill disks — logrotate state?); (4) RDS storage/connection alarms via free CloudWatch. For
each: exact implementation, cost (target: ~$0), and what page-worthy vs morning-review means.
```

### DEPLOY-5 — Incident response (postmortem)

Use BUG-7 during the incident; use this after:

```text
Write a postmortem for: {{INCIDENT SUMMARY + timeline notes}}.
Format (keep it one page, blameless, in docs/ops/postmortems/YYYY-MM-DD-slug.md): impact
(users/bookings/money affected — query event_log and Stripe for real numbers, don't estimate),
timeline (detection → mitigation → resolution with timestamps), root cause (the BUG-1 standard:
falsifiable, evidenced), why detection took as long as it did (this is the highest-value
section — map it to a specific missing alert/smoke assertion from DEPLOY-4), and follow-ups as
a checklist with effort estimates, distinguishing "prevents recurrence" from "nice hardening".
Add the incident to the handbook §18 if it revealed structural debt.
```

---

# 14. Solo Founder

### SOLO-1 — Weekly engineering review

**Use when:** end of each week. Give the AI repo access; it does the archaeology.

```text
Run my weekly engineering review. Look at: git log --since="1 week ago" (all branches), current
branch state vs main, test suite status (run them), any new TODO/FIXME/HACK comments added this
week, and docs/release/public-launch-checklist.md progress.
Report: (1) what actually shipped vs what the commits claim (read the diffs, not just messages);
(2) risk introduced this week — anything touching §20 invariants that lacks tests; (3) drift —
started-but-abandoned work sitting uncommitted or unmerged (I have a habit of wide uncommitted
changesets — the working tree right now is evidence); (4) the ONE thing from this week that
will bite in a month if not finished; (5) next week's suggested focus in one sentence, checked
against the launch checklist. Be direct; don't pad; challenge my prioritization if the evidence
says to.
```

### SOLO-2 — Monthly product review

```text
Run my monthly product review for FreeSpace. Pull what you can from: PostHog (if I paste
exports), event_log via read-only SQL I'll run for you (write the queries: bookings created/
confirmed/canceled by week, GMV in cents, new users, new listings, searches with zero results,
top search areas), Stripe dashboard numbers I'll paste, and store metrics if live.
Structure: metrics vs last month with honest interpretation (small numbers = say "too small to
trend", don't fake insight); funnel health (where's the biggest leak?); supply/demand balance
per PROD-4's liquidity lens; one paragraph: "if nothing changes, where is this in 6 months?";
and the month's top 3 priorities with a kill-list of things to stop doing. End by updating my
memory of decisions: list what we decided so I can record it.
```

### SOLO-3 — Technical debt review

```text
Run a technical debt review. Start from handbook §18's ledger (C1–C2, H1–H7, M1–M10, Low) —
verify each item's CURRENT status against the code (some may be fixed; prove it, mark it).
Then hunt for NEW debt accumulated since the handbook date: grep for TODO/FIXME/HACK newer than
it, files that grew >20% (db.ts and bookings.ts are the watch-list), new duplication, new
dependencies added casually. Re-rank the combined list by (production damage × likelihood ×
proximity to launch). Deliver: the refreshed ledger as a handbook §18 diff + a "next debt day"
plan: the best 1 day of debt work right now, sequenced hour by hour.
```

### SOLO-4 — Competitor analysis

```text
Analyze the competitive landscape for FreeSpace (P2P parking, Ireland). Competitors to cover:
JustPark and YourParkingSpace (UK giants, both operate/could operate in Ireland), ParkPnP
(Irish incumbent — current status?), Sharedeasy/local councils' offerings, and the default
alternatives (on-street, commercial car parks, cheeky free parking). For each: Irish presence
and Dublin liquidity (check their apps/sites for real listing counts in {{AREAS}}), pricing
model and take rate vs our 8%, feature deltas that matter (instant book, monthly subscriptions
— they have it, we don't yet; barrier/ANPR integrations), and their weakness a solo local
player can exploit (support quality, host payout speed, local trust, event-day focus).
End with: positioning statement for FreeSpace in one sentence, and the 3 product/marketing moves
this analysis actually justifies. Cite sources; flag anything you couldn't verify as assumption.
```

### SOLO-5 — Growth ideas (grounded)

```text
Generate growth ideas for FreeSpace — but grounded, not brainstorm slop. Rules: every idea must
name the user insight it exploits, use capabilities we HAVE (QR walk-up portal, promo codes,
push, event_log data, host wizard) or cost <2 days to build, and include its kill criteria
(what result in 2 weeks means stop). Seed areas: event-day surges (match/concert calendars are
public data — what could we build on them?), the QR portal as a host-side growth loop (every
QR sign is a billboard), zero-result searches as a supply-acquisition signal (email me the
map?), B2B (hospitals/offices with visitor parking pain). Deliver: 10 ideas, then rank and
fully spec only the top 2.
```

### SOLO-6 — Revenue opportunities

```text
Analyze revenue expansion for FreeSpace beyond the current 8% booking fee. Evaluate against
effort and strategic fit: monthly subscriptions (the known #1 lever — schema has price_per_month,
Stripe Billing is the target; estimate revenue per 10 monthly spots at Dublin rates), dynamic/
event pricing (surge for match days — host opt-in, platform keeps the same %), featured
placement for hosts (search is geo-sorted — what does "featured" even mean here? be honest if
it degrades the product), driver-side convenience fees (line-item transparency per the roadmap
note — does unbundling the 8% increase or decrease conversion?), corporate/fleet accounts,
and cancellation-policy tiers (partial refunds = retained revenue but also a product promise
change). For each: revenue math with explicit assumptions, effort, and what it risks. Recommend
a sequence; monthly subscriptions is presumed #1 — argue if you disagree.
```

### SOLO-7 — Cost reduction review

Use ARCH-5 for the AWS deep-dive; this is the monthly skim:

```text
Monthly cost skim. I'll paste: AWS bill, Stripe fees summary, and any SaaS invoices (Expo/EAS,
PostHog, Sentry, Google Maps usage, domain/email). For each: trend vs last month, unit economics
check (cost per booking — are Maps geocoding/Places calls growing faster than bookings? the
nearby-JSONB cache should prevent that; verify), free-tier boundaries approaching, and one
action if any line grew >20%. Target: total infra+tools under {{CAP, default €100}}/mo
pre-revenue. Two-minute read, table format.
```

### SOLO-8 — Automation opportunities

```text
Find automation opportunities in my weekly operations. Current manual work: {{LIST, e.g.
"reviewing new listings, answering support tickets, checking smoke results, payout runs (no
cron — known H7), App Store Connect changes, fraud-flag review"}}.
For each: automation level possible (full auto / auto-with-approval / better tooling only —
payouts should be auto-with-reconciliation-report per the roadmap, listing moderation
probably needs my eyes but could be queue-ified in the admin panel), implementation using what
exists (admin routes, event_log, the notification pipeline, GH Actions cron), effort, and
risk of automating it badly (money and moderation automations fail expensive — bias to
approval-gated). Deliver: ranked list, then implement the top pick end-to-end.
```

---

# The Top 20 — Highest long-term ROI for this repo

Ranked by (frequency of use × cost of doing it badly × specificity to this codebase):

| # | Prompt | Why it earns its rank |
|---|---|---|
| 1 | **Master Prompt** (below) | Every session starts safer; front-loads the invariants that prevent money bugs |
| 2 | **FEAT-7 Payments** | Highest-risk code in the repo; one bad prompt-guided change = real financial incident |
| 3 | **TEST-2 Integration tests** | Directly closes the gap (M10) that let the two worst bugs ship; pays forever |
| 4 | **BUG-1 Root cause** | The default debugging discipline; stops symptom-patching which this codebase punishes |
| 5 | **REV-1 PR review** | Invariant-aware review of every diff; the cheapest quality gate a solo founder has |
| 6 | **FEAT-2 Backend feature** | The most common task; encodes the house pattern so every feature lands consistent |
| 7 | **FEAT-1 Mobile screen** | Second most common task; stops the UI-kit drift that already produced 3 kits |
| 8 | **DEPLOY-1 Release readiness** | Catches the pk_test-in-prod class of mistake before a 40-min build or a live deploy |
| 9 | **FEAT-3 Migration** | Migrations are append-only and irreversible; the enum landmine proves the stakes |
| 10 | **BUG-7 Production incident** | When it's needed, nothing else matters; pre-encodes the dead-ECS-rollback trap |
| 11 | **SOLO-1 Weekly review** | Compounds weekly; catches drift and uncommitted-work sprawl early |
| 12 | **SEC-4 Payment security** | Card testing and promo abuse arrive with launch traffic, not after |
| 13 | **PROD-1 Prioritization** | Solo founders lose more to wrong priorities than wrong code |
| 14 | **REV-6 Store readiness** | iOS has never been submitted; first submission failures cost weeks |
| 15 | **DOC-1 Handbook update** | The handbook is the AI-context flywheel — stale handbook degrades every other prompt |
| 16 | **TEST-6 Manual QA checklist** | The money-path smoke before every release; cheap insurance |
| 17 | **SOLO-3 Debt review** | Keeps the §18 ledger honest; debt here is documented but decays without review |
| 18 | **UI-1 Premium UI review** | Encodes the agreed design bar; prevents relitigating settled decisions |
| 19 | **SEC-3 IDOR sweep** | Marketplace + hand-rolled auth checks = the classic breach; systematic beats vibes |
| 20 | **ARCH-2 Feature design** | Design-before-code with repo constraints prevents the expensive class of rework |

---

# Master Prompt

Paste this (or reference the files it names) at the start of any AI conversation about this repo.
If the tool auto-loads `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`, you can skip it — they carry the same content.

```text
You are working on FreeSpace (repo "carpark") — a peer-to-peer parking marketplace for Ireland.
Before doing ANYTHING, read docs/ENGINEERING_HANDBOOK.md §20 (AI Context) and §21 (Quick
Reference). If you can't read files, tell me and I'll paste them.

STACK: Yarn-workspaces monorepo. apps/api = Express + TypeScript ESM + raw pg/PostGIS (NO ORM —
all SQL in src/lib/db.ts) + Zod + Stripe. apps/web = Next.js 15 App Router + Tailwind + Mapbox.
apps/mobile = Expo 54 / RN 0.81 / React 19, React Navigation, Stripe Payment Sheet.
DB = Postgres+PostGIS, append-only SQL migrations in db/migrations/ (never edit applied ones).
Prod = one Lightsail box (Caddy + containers) + RDS, deployed by GH Actions over SSH.

INVARIANTS — violating these is a production incident, not a style issue:
1. Server owns ALL money math: price = parking × 1.08, fee = gross × 8/108, integer cents
   (_cents suffix). Client-sent amounts are verified, never trusted.
2. apps/mobile/utils/pricing.ts must stay IDENTICAL in behavior to the API's
   calculateListingChargeCents (apps/api/src/routes/bookings.ts) — change both together with
   both test suites.
3. Stripe webhooks are the source of truth for payment state; client confirm is an optimization;
   everything is idempotency-keyed; never overwrite bookings.payment_intent_id.
4. Booking capacity/overlap safety lives in the DB trigger (P0001 → HTTP 409). Route checks are
   fast-fail conveniences only.
5. Confirmed bookings are frozen contracts (snapshot fields); new booking-status values need an
   enum migration FIRST (this bit us before).
6. app.ts middleware order: the Stripe webhook raw-body exemption must stay ahead of body parsing.
7. New listing queries must exclude status='archived' AND respect is_active.
8. Mobile UI: compose from components/ui/* + styles/theme.ts tokens (Plus Jakarta Sans). No new
   UI-kit imports, no hardcoded styles. Map guardrails: no auto-search, green v30 pins, no fake
   loaders. freezeOnBlur means covered screens need refresh params, not focus effects.

WORKFLOW: design before code for anything multi-file; new API endpoints get mirrored in
apps/web/lib/api.ts and apps/mobile/api.ts; tests per apps/api/tests style (note: DB is mocked —
tell me when a change needs real-DB verification); verify with npm run test:api /
typecheck:mobile / prepush:check. Comments explain WHY, never what. I'm a solo founder — bias to
small reversible steps, tell me the honest risk, and challenge me when I'm wrong.

My current task: {{TASK}}
```

---

# Cheat Sheet — which prompt when

| Situation | Prompt |
|---|---|
| Starting any new AI session | **Master Prompt** |
| "How does X work?" | ARCH-1 (spoken) / DOC-2 (written) |
| New feature, any size beyond one file | ARCH-2 → then FEAT-1/2/4 |
| New mobile screen | FEAT-1 |
| New API endpoint | FEAT-4 (contract) → FEAT-2 (build) |
| Schema change | FEAT-3 |
| Anything touching Stripe/money | FEAT-7 (+ SEC-4 before launch) |
| Anything touching login/tokens | FEAT-8 (+ SEC-2 periodically) |
| Map work | FEAT-6 |
| Push/email/SMS | FEAT-10 |
| Bug, cause unknown | BUG-1 |
| Mobile crash / Sentry event | BUG-2 |
| Double-booking / duplicate charge / weird state | BUG-3 |
| "Sometimes doesn't load" / hangs | BUG-4 |
| Visual glitch | BUG-5 |
| Flaky-network complaints | BUG-6 |
| **Prod is down right now** | **BUG-7** (afterwards: DEPLOY-5) |
| Before merging a branch | REV-1 (+ REV-2 if auth/money/admin) |
| Before a store submission | REV-6 → DEPLOY-1 |
| Big file needs splitting | REF-1 |
| Screen is a mess but works | REF-2 |
| Same code in 3 places | REF-3 |
| Dead configs / repo cruft | REF-5 |
| App feels slow to open | PERF-1 |
| Jank while scrolling / panning map | PERF-2 |
| Slow endpoint / query | PERF-4 |
| App/bundle too big | PERF-5 |
| Quarterly security pass | SEC-1 (+ SEC-3, SEC-5) |
| Launch-week fraud prep | SEC-6 + SEC-4 |
| GDPR / account deletion | SEC-7 |
| Screen works but feels cheap | UI-1 |
| Screens look inconsistent | UI-2 |
| Add polish/animations | UI-3 |
| Spinners and blank screens | UI-4 |
| Error messages confuse users | UI-5 |
| Writing tests for new code | TEST-1 |
| Building real-DB test tier | TEST-2 |
| Guarding a user flow end-to-end | TEST-3 |
| "What could break here?" | TEST-4 |
| Just fixed a bug | TEST-5 |
| Before hitting release | TEST-6 + DEPLOY-1 |
| "What should I build next?" | PROD-1 |
| Users drop off in a flow | PROD-2 / PROD-3 |
| Not enough hosts / bookings | PROD-4 / PROD-5 |
| Store listing copy | MKT-1 |
| Planning launch | MKT-2 |
| Google traffic | MKT-3 |
| After merging notable changes | DOC-1 |
| Friday afternoon | SOLO-1 |
| First of the month | SOLO-2 + SOLO-7 |
| Debt day | SOLO-3 |
| Feeling FOMO about competitors | SOLO-4 |
| Revenue brainstorm | SOLO-6 |
| Doing the same chore 3rd time | SOLO-8 |

---

*Maintenance note: this library assumes the facts in `docs/ENGINEERING_HANDBOOK.md` (2026-07-06).
When the handbook's §18 debt items get fixed (the enum bug, pk_test in prod, etc.), update the
prompts that reference them — DOC-1 is the prompt for that job.*

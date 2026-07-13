# FreeSpace — System Architecture

Technical design documentation for the FreeSpace peer-to-peer parking marketplace
(freespace.ie). Every diagram documents the **actual deployed system** as of July 2026 —
sources were verified against `apps/api/src`, `apps/mobile`, `apps/web`, and
`deploy/lightsail` rather than an aspirational design. Where a commonly expected capability
does not exist (direct driver–host messaging, a payout cron), the diagram says so instead of
inventing it.

All diagrams are Mermaid and render natively on GitHub. Flowcharts share one colour code:

- **Blue** — client applications (Expo mobile, Next.js web)
- **Slate** — edge and infrastructure (Caddy, Lightsail, CI/CD)
- **Green** — the API application domain (Express, single process)
- **Amber** — data at rest (RDS Postgres + PostGIS, S3)
- **Violet** — external services (Stripe, Google, Expo Push, SMTP, SNS, Anthropic, PostHog)
- **Pink** — asynchronous work (webhooks, background loops)

## 0. At a glance

The whole system in one picture: two sides of a marketplace, one API, one database, and
Stripe closing the money loop. Everything else in this document is detail inside these boxes.

```mermaid
flowchart LR
  driver["Driver"]
  host["Host"]
  apps["FreeSpace apps<br/>iOS · Android · Web"]
  api["FreeSpace API<br/>one Express server on AWS"]
  db[("Postgres<br/>listings · bookings · users")]
  stripe["Stripe"]
  notif["Push · Email · SMS"]

  driver -->|"search · book · pay"| apps
  host -->|"list spaces · manage"| apps
  apps --> api
  api --> db
  api -->|"charge driver ~8% fee included"| stripe
  stripe -->|"payout"| host
  api --> notif
  notif -.->|"confirmations · reminders"| driver

  classDef client fill:#DBEAFE,stroke:#1D4ED8,color:#1E3A8A
  classDef app fill:#DCFCE7,stroke:#15803D,color:#14532D
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  classDef ext fill:#EDE9FE,stroke:#6D28D9,color:#4C1D95
  class driver,host,apps client
  class api,notif app
  class db data
  class stripe ext
```

**Reading notes**

- A driver books and pays in the app; the API records it in Postgres and charges through
  Stripe; the host gets paid out by Stripe; both sides get notified. That is the entire
  business in one loop.

## 1. Overall system architecture

One Express process serves both clients through Caddy. There is no ORM: every SQL statement
lives in `lib/db.ts`. Stripe is the only money authority — the API creates PaymentIntents and
transfers, and Stripe webhooks (raw-body routes, exempt from the JSON parser) are the source
of truth for booking confirmation and Connect account state. Background work runs as
`setInterval` loops inside the same process, which is why rate limits and fraud caches are
documented as in-memory: **the architecture assumes exactly one API instance.**

```mermaid
flowchart LR
  subgraph clients["Client Applications"]
    direction TB
    mobile["FreeSpace Mobile<br/>Expo SDK 54 · React Native 0.81<br/>JWT in SecureStore · Stripe Payment Sheet<br/>native map SDK for pins"]
    web["freespace.ie Web<br/>Next.js 15 App Router<br/>Mapbox GL JS"]
  end

  subgraph edge["Edge"]
    caddy["Caddy reverse proxy<br/>TLS termination"]
  end

  subgraph apid["API Application Domain — Express, single Node process"]
    direction TB
    mw["Middleware chain<br/>CSRF · in-memory per-user rate limits<br/>JSON body parser — both Stripe webhook<br/>routes exempted for raw-body signatures"]
    subgraph routers["Domain routers — /api/*"]
      rauth["auth"]
      rbook["bookings · payments"]
      rlist["listings · favorites · reviews"]
      rhost["host — Connect onboarding"]
      rops["notifications · support · config"]
      radmin["admin"]
      rana["analytics — first-party event_log"]
      rauth ~~~ rbook
      rlist ~~~ rhost
      rops ~~~ radmin
    end
    dbmod["lib/db.ts<br/>every SQL query · parameterized only<br/>ownership checks in WHERE clauses"]
    loops["Background loops — setInterval<br/>stale-pending booking sweeper<br/>booking-completion sweep<br/>scheduled-notification processor"]
  end

  subgraph datad["Data Domain"]
    pg[("RDS PostgreSQL + PostGIS<br/>check_booking_capacity trigger<br/>event_log · schema_migrations")]
    s3[("S3<br/>listing photos")]
  end

  subgraph extd["External Services"]
    direction TB
    stripe["Stripe<br/>PaymentIntents · Refunds<br/>Connect accounts + transfers"]
    gmaps["Google Geocoding API"]
    expo["Expo Push Service"]
    smtp["SMTP relay — nodemailer"]
    sns["AWS SNS — transactional SMS"]
    claude["Anthropic API<br/>listing-description drafts"]
    ph["PostHog<br/>server + client telemetry"]
  end

  mobile -->|"HTTPS · JSON · Bearer JWT"| caddy
  web -->|"HTTPS · JSON"| caddy
  mobile -.->|"PAYMENT SHEET CONFIRM"| stripe
  caddy --> mw --> routers
  routers --> dbmod --> pg
  rlist -->|"photo storage"| s3
  rlist -->|"geocode fallback on create"| gmaps
  rlist -->|"draft description"| claude
  rbook -->|"CREATE PAYMENT INTENT<br/>idempotency key"| stripe
  stripe -->|"PAYMENT INTENT SUCCEEDED /<br/>FAILED / CANCELED — webhook"| rbook
  stripe -->|"CONNECT ACCOUNT UPDATED<br/>— connect-webhook"| rbook
  rhost -->|"accounts + accountLinks"| stripe
  radmin -->|"manual payout run<br/>transfers.create"| stripe
  loops --> dbmod
  loops -->|"push tickets"| expo
  loops --> smtp
  loops --> sns
  mobile -.->|"telemetry"| ph
  web -.-> ph

  classDef client fill:#DBEAFE,stroke:#1D4ED8,color:#1E3A8A
  classDef infra fill:#E2E8F0,stroke:#475569,color:#1E293B
  classDef app fill:#DCFCE7,stroke:#15803D,color:#14532D
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  classDef ext fill:#EDE9FE,stroke:#6D28D9,color:#4C1D95
  classDef async fill:#FCE7F3,stroke:#BE185D,color:#831843
  class mobile,web client
  class caddy infra
  class mw,rauth,rlist,rbook,rhost,rops,radmin,rana,dbmod app
  class loops async
  class pg,s3 data
  class stripe,gmaps,expo,smtp,sns,claude,ph ext
  style clients fill:#EFF6FF,stroke:#1D4ED8,stroke-dasharray:6 4
  style edge fill:#F8FAFC,stroke:#475569,stroke-dasharray:6 4
  style apid fill:#F0FDF4,stroke:#15803D,stroke-dasharray:6 4
  style routers fill:#FFFFFF,stroke:#86EFAC,stroke-dasharray:3 3
  style datad fill:#FFFBEB,stroke:#B45309,stroke-dasharray:6 4
  style extd fill:#F5F3FF,stroke:#6D28D9,stroke-dasharray:6 4
```

**Reading notes**

- The two dashed client edges to Stripe and PostHog are direct client↔service calls that
  bypass the API: the Stripe Payment Sheet confirms payment on-device, and telemetry ships
  straight to PostHog.
- The `analytics` router is first-party: it writes client events to `event_log` in Postgres,
  separate from PostHog.
- Both webhook arrows terminate at the bookings router deliberately — webhook handling and
  the payout trigger live in `routes/bookings.ts`, not in a separate worker.

## 2. Infrastructure & deployment architecture

Production is deliberately small: one Lightsail box running three containers via
`deploy/lightsail/compose.prod.yml`, plus managed RDS. The former ECS/ALB stack was torn down
in June 2026 — the `rollback-api.yml` workflow still targets it and must not be used; rollback
is manual per `docs/ops/rollback-playbook.md`.

```mermaid
flowchart LR
  subgraph ci["Source & CI/CD"]
    direction TB
    repo["GitHub repository<br/>main branch"]
    gha["GitHub Actions<br/>ci.yml · deploy-api.yml<br/>deploy-web.yml · smoke-test.yml"]
  end

  subgraph aws["AWS — eu-west-1"]
    direction LR
    ecr["ECR<br/>api + web images"]
    subgraph box["Lightsail instance — static IP"]
      direction TB
      caddy2["caddy container<br/>:443 TLS · reverse proxy"]
      webc["web container<br/>Next.js · :3000"]
      apic["api container<br/>Express · :4000<br/>runs migrate.ts on deploy"]
    end
    rds[("RDS PostgreSQL<br/>+ PostGIS")]
    s3b[("S3 bucket<br/>listing photos")]
    snsb["SNS<br/>transactional SMS"]
  end

  users["Drivers · Hosts · Admins"]
  dns["DNS — freespace.ie"]

  repo -->|"PUSH TO MAIN"| gha
  gha -->|"BUILD + PUSH IMAGES"| ecr
  gha -->|"SSH — compose pull · compose up"| box
  ecr -->|"image pull"| box
  apic -->|"DB MIGRATIONS<br/>one transaction per file"| rds
  gha -->|"POST-DEPLOY SMOKE TEST"| dns
  users --> dns --> caddy2
  caddy2 --> webc
  caddy2 --> apic
  apic --> rds
  apic --> s3b
  apic --> snsb

  classDef client fill:#DBEAFE,stroke:#1D4ED8,color:#1E3A8A
  classDef infra fill:#E2E8F0,stroke:#475569,color:#1E293B
  classDef app fill:#DCFCE7,stroke:#15803D,color:#14532D
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  class users,dns client
  class repo,gha,ecr,caddy2 infra
  class webc,apic app
  class rds,s3b,snsb data
  style ci fill:#F8FAFC,stroke:#475569,stroke-dasharray:6 4
  style aws fill:#FFF7ED,stroke:#B45309,stroke-dasharray:6 4
  style box fill:#F1F5F9,stroke:#475569,stroke-dasharray:3 3
```

**Reading notes**

- Deploy pipeline: push to `main` → Actions build → ECR → SSH to the box → `compose up` →
  `migrate.ts` (append-only numbered SQL, one transaction per file, tracked in
  `schema_migrations`) → smoke test against the live domain.
- The single-instance constraint is architectural, not incidental: rate limits and fraud
  caches live in process memory. Scaling to a second API container requires a Redis-backed
  redesign first.
- Environment is validated by Zod at boot (`src/env.ts`); the api container refuses to start
  on bad config rather than degrading.

## 3. Authentication flow

Auth is stateless JWT (HS256, 7-day expiry) minted by `/api/auth` and verified by
`requireAuth` middleware. Money-touching capabilities are gated harder than plain login:
booking, hosting, and payments all additionally require a verified email and a non-suspended
account.

```mermaid
sequenceDiagram
  autonumber
  participant C as Client — mobile / web
  participant A as API — /api/auth
  participant DB as Postgres
  participant M as SMTP relay

  C->>A: POST /register — email, password
  A->>DB: INSERT user — password hash, email_verified = false
  A->>M: send verification email — tokenized link
  M-->>C: VERIFICATION EMAIL
  C->>A: verify email token
  A->>DB: UPDATE users SET email_verified = true
  C->>A: POST /login — credentials
  A->>DB: fetch user — hash check + suspension check
  A-->>C: JWT — HS256 · 7-day expiry
  Note over C: token stored in SecureStore on mobile ·<br/>localStorage on web (known debt — see §18 handbook)
  C->>A: subsequent requests — Authorization: Bearer JWT
  Note over A: requireAuth on protected routes.<br/>Booking / hosting / payments additionally require<br/>email_verified = true AND account not suspended.
```

**Reading notes**

- There is no refresh-token rotation; the 7-day JWT is the whole session. Expiry forces
  re-login.
- Suspension is checked at login **and** enforced per-request on gated routes, so suspending
  a user takes effect before their token expires.

## 4. Search & discovery flow

Search is explicit and honest: no auto-search on map move, no artificial loaders. The server
owns geography (PostGIS radius queries) and display price (parking cost × 1.08, computed
server-side and shown as a single number to the driver).

```mermaid
sequenceDiagram
  autonumber
  participant D as Driver — mobile map
  participant A as API — /api/listings
  participant DB as Postgres + PostGIS

  D->>D: pick location + time window
  Note over D: explicit action only — the map never<br/>auto-searches on pan or zoom
  D->>A: GET /listings — coordinates, radius, filters
  A->>DB: PostGIS radius query
  Note over DB: excludes status = archived ·<br/>respects is_active
  DB-->>A: matching listings
  A-->>D: results — driver price = parking × 1.08, in cents
  D->>D: render green price pins — native map SDK
  D->>A: GET /listings/:id — detail, photos, reviews, live availability
```

**Reading notes**

- Listing photos are served from S3; addresses were geocoded at creation time (Google
  Geocoding fallback when the client sends zeroed coordinates), so search itself never calls
  an external geo service.
- Availability shown here is a convenience read. The real capacity guarantee is the DB
  trigger in the booking flow (§5).

## 5. Booking flow

The core marketplace transaction. Three invariants shape it: the server owns all money math
and rejects mismatched client totals; the `check_booking_capacity` trigger — not route code —
is what prevents overbooking; and the Stripe webhook, not the client, is the source of truth
for confirmation.

```mermaid
sequenceDiagram
  autonumber
  participant D as Driver app
  participant A as API — /api/bookings
  participant DB as Postgres
  participant S as Stripe

  D->>D: local quote — utils/pricing.ts<br/>(kept in parity with the server)
  D->>A: POST /bookings — listing, window, client total in cents
  A->>A: recompute calculateListingChargeCents
  alt client total ≠ server total
    A-->>D: 400 — "price out of date"
  else totals match
    A->>DB: INSERT booking — status = pending
    Note over DB: check_booking_capacity trigger<br/>raises P0001 on overbook → HTTP 409
    A->>S: create PaymentIntent — idempotency key per booking
    A-->>D: clientSecret
    D->>S: PAYMENT SHEET — confirm on device
    S-->>A: WEBHOOK payment_intent.succeeded<br/>raw body · signature verified
    A->>DB: guarded UPDATE — pending → confirmed<br/>WHERE status = pending
    Note over DB: snapshot fields frozen on confirm —<br/>title / address / coords / amount.<br/>Access code stays a live read.
    A->>A: schedule notifications + process due host payouts
    A-->>D: booking confirmed — push + email
  end
  opt payment abandoned
    Note over A,DB: stale-pending sweeper (default 5 min)<br/>cancels unpaid pendings so they stop<br/>squatting the listing's capacity
  end
```

**Reading notes**

- The client-side confirm path also exists but is only an optimization; both paths are
  idempotent, so a replayed webhook or a race between the two cannot double-confirm.
- A separate completion sweep advances confirmed bookings past their end time to
  `completed`, which is what makes them payout-eligible (§8).
- Confirmed bookings are contracts: listing edits and archival must never mutate the frozen
  snapshot (shipped as migration 042).

## 6. Payment flow

Money is integer cents everywhere (`_cents` suffix), and the platform fee is baked into the
displayed price rather than added at checkout: the driver pays parking × 1.08 and the fee is
gross × 8⁄108.

```mermaid
flowchart LR
  subgraph math["Server-owned money math — integer cents only"]
    direction TB
    base["host parking cost"]
    gross["driver price<br/>= parking × 1.08"]
    fee["platform fee ≈ 8%<br/>= gross × 8 ÷ 108"]
    net["host net<br/>= gross − fee"]
    base --> gross
    gross --> fee
    gross --> net
  end

  subgraph intent["PaymentIntent lifecycle"]
    direction TB
    pend["booking: pending<br/>intent created — idempotency key"]
    ok["payment_intent.succeeded"]
    bad["payment_intent.payment_failed /<br/>payment_intent.canceled"]
    confirmed["booking: confirmed<br/>snapshot frozen"]
    swept["booking cancelled by<br/>stale-pending sweeper"]
    pend -->|"WEBHOOK"| ok --> confirmed
    pend -->|"WEBHOOK"| bad --> swept
  end

  subgraph rules["Hard rules"]
    direction TB
    r1["client-sent totals verified against<br/>server calculation — rejected on mismatch"]
    r2["bookings.payment_intent_id is never<br/>overwritten — top-up charges go to<br/>booking_payments"]
    r3["refund idempotency keys:<br/>refund:reason:booking:intent"]
  end

  math --> intent
  intent -.-> rules

  classDef app fill:#DCFCE7,stroke:#15803D,color:#14532D
  classDef async fill:#FCE7F3,stroke:#BE185D,color:#831843
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  class base,gross,fee,net app
  class pend,ok,bad,confirmed,swept async
  class r1,r2,r3 data
  style math fill:#F0FDF4,stroke:#15803D,stroke-dasharray:6 4
  style intent fill:#FDF2F8,stroke:#BE185D,stroke-dasharray:6 4
  style rules fill:#FFFBEB,stroke:#B45309,stroke-dasharray:6 4
```

**Reading notes**

- `apps/mobile/utils/pricing.ts` must stay behaviourally identical to the API's
  `calculateListingChargeCents`; they change together with both test suites or every booking
  400s with "price out of date".
- Every Stripe create call carries an idempotency key, so webhook replays and network
  retries are safe by construction.

## 7. Cancellation & refund flow

Refunds are tiered by `lib/cancellationPolicy.ts` — a 15-minute post-booking grace window
and a 4-hour free cutoff before the start time, with reduced refunds inside the final hours
when the space is committed.

```mermaid
sequenceDiagram
  autonumber
  participant U as Driver
  participant A as API — /api/bookings
  participant P as cancellationPolicy
  participant S as Stripe
  participant DB as Postgres

  U->>A: cancel booking
  A->>P: evaluateCancellationRefund — booked-at, start time, now
  alt within 15-minute grace after booking
    P-->>A: full refund
  else 4+ hours before start
    P-->>A: full refund
  else inside final 4 hours or after start
    P-->>A: partial or no refund — space committed
  end
  A->>S: refunds.create — key refund:reason:booking:intent
  A->>DB: guarded UPDATE — confirmed → cancelled<br/>WHERE status = confirmed
  Note over DB: rowCount is the outcome — a lost race<br/>(already cancelled / completed) changes nothing
  A->>DB: insertEventLog — cancellation + refund decision
  A-->>U: cancellation confirmed — refund summary
  A->>A: notify host — push / email
```

**Reading notes**

- The deterministic refund key means retrying a failed cancellation can never double-refund.
- Host-side and admin-side cancellations follow the same guarded-update pattern with their
  own refund reasons, which produce distinct idempotency keys.

## 8. Host payout flow

Payouts use Stripe Connect Express accounts and destination transfers of the host's net
(gross − platform fee). There is **no payout cron**: transfers run opportunistically inside
the payment webhook whenever any of the host's bookings gets paid, plus a manual admin
trigger (`POST /api/admin/payouts/run`). A host with no new bookings can therefore wait
indefinitely — a known launch-hardening gap.

```mermaid
sequenceDiagram
  autonumber
  participant H as Host app
  participant A as API — /api/host
  participant S as Stripe Connect
  participant W as Webhook handlers — routes/bookings.ts
  participant DB as Postgres

  rect rgb(240, 249, 244)
    Note over H,DB: ONBOARDING
    H->>A: start payout setup
    A->>S: accounts.create — Express account
    A->>S: accountLinks.create
    A-->>H: hosted onboarding URL
    H->>S: complete KYC on Stripe-hosted flow
    S-->>W: CONNECT WEBHOOK — account.updated
    W->>DB: store account id + capability status
  end

  rect rgb(253, 244, 248)
    Note over W,DB: TRANSFER — triggered by payment_intent.succeeded<br/>for any of this host's bookings
    W->>DB: listDuePayoutsForHost — completed, unpaid bookings
    loop each due booking
      W->>DB: markPayoutProcessing — lock row, skip if taken
      W->>S: transfers.create — net = amount − fee,<br/>metadata: booking_id
      alt transfer succeeded
        W->>DB: markPayoutTransferred — transfer id recorded
      else transfer failed
        W->>DB: markPayoutPending — retried on next trigger
      end
    end
  end

  Note over A,S: Admin can force the same sweep via<br/>POST /api/admin/payouts/run (§12)
```

**Reading notes**

- The `markPayoutProcessing` lock is what makes concurrent webhook deliveries safe: only one
  handler can move a booking from pending to processing.
- Transfers are skipped entirely unless `STRIPE_CONNECT_ENABLED=true` and the host has a
  real (non-mock) Connect account — the local/dev lanes run with mock accounts.

## 9. Messaging & support flow

**Direct driver↔host messaging is not implemented.** There is no messages table, router, or
realtime channel in the codebase; contact between parties happens through booking metadata
(access code, arrival instructions) and notifications. What exists today is a support-ticket
pipeline into the admin surface — the diagram documents that real flow, with in-thread
messaging left as a roadmap item rather than drawn as if it existed.

```mermaid
sequenceDiagram
  autonumber
  participant U as Driver / Host
  participant A as API — /api/support
  participant DB as Postgres
  participant M as SMTP relay
  participant O as Ops alerts
  participant Ad as Admin — /api/admin/support

  U->>A: POST /support — subject, message (rate limited per user)
  A->>DB: createSupportTicket + insertEventLog
  A->>M: acknowledge to user · copy to support inbox
  A->>O: reportOperationalAlert — new ticket
  Ad->>A: GET /admin/support — open tickets
  Ad->>A: PATCH /admin/support/:id — triage / resolve
  A->>DB: update ticket status + event log
  Ad-->>U: reply by email — outside the app
  Note over U,Ad: NOT IMPLEMENTED: driver↔host threads,<br/>realtime delivery, in-app inbox. Documented as<br/>roadmap, not architecture.
```

**Reading notes**

- If in-app messaging is built later, the single-process constraint matters: realtime
  delivery (websockets/SSE) would be the first feature to break the "one API container"
  assumption after horizontal scaling.

## 10. Notification delivery

Notifications are queued in Postgres and drained by a processor that can be invoked two
ways: an in-process interval loop, and a secret-protected `POST /notifications/process`
endpoint for external triggering. Delivery fans out to three channels.

```mermaid
flowchart LR
  subgraph producers["Producers"]
    direction TB
    p1["booking confirmed — webhook"]
    p2["arrival / end reminders —<br/>scheduleBookingNotifications"]
    p3["cancellations · payouts · support"]
  end

  subgraph queue["Queue — Postgres"]
    ntable[("notifications table<br/>scheduled_at · delivery state")]
  end

  subgraph processor["Processor — same API process"]
    direction TB
    tick["setInterval loop —<br/>NOTIFICATION_PROCESSOR_INTERVAL_MS"]
    httpx["POST /notifications/process<br/>x-notification-secret header"]
    psn["processScheduledNotifications<br/>batch of 50"]
    tick --> psn
    httpx --> psn
  end

  subgraph channels["Delivery channels"]
    direction TB
    cpush["Expo Push Service<br/>tokens from POST /notifications/register"]
    cmail["Email — nodemailer SMTP<br/>templates in lib/emailTemplates.ts"]
    csms["SMS — AWS SNS · transactional"]
  end

  devices["Driver & host devices"]

  p1 --> ntable
  p2 --> ntable
  p3 --> ntable
  ntable -->|"due rows"| psn
  psn -->|"mark sent / failed"| ntable
  psn --> cpush
  psn --> cmail
  psn --> csms
  cpush -->|"PUSH"| devices
  cmail -->|"EMAIL"| devices
  csms -->|"SMS"| devices

  classDef async fill:#FCE7F3,stroke:#BE185D,color:#831843
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  classDef app fill:#DCFCE7,stroke:#15803D,color:#14532D
  classDef ext fill:#EDE9FE,stroke:#6D28D9,color:#4C1D95
  classDef client fill:#DBEAFE,stroke:#1D4ED8,color:#1E3A8A
  class p1,p2,p3 async
  class ntable data
  class tick,httpx,psn app
  class cpush,cmail,csms ext
  class devices client
  style producers fill:#FDF2F8,stroke:#BE185D,stroke-dasharray:6 4
  style queue fill:#FFFBEB,stroke:#B45309,stroke-dasharray:6 4
  style processor fill:#F0FDF4,stroke:#15803D,stroke-dasharray:6 4
  style channels fill:#F5F3FF,stroke:#6D28D9,stroke-dasharray:6 4
```

**Reading notes**

- Device push tokens are registered per-user via `POST /notifications/register` (and removed
  via `DELETE`), both behind auth, a blocked-list check, and a rate limiter.
- Queuing through Postgres rather than firing inline means a channel outage delays delivery
  instead of losing it — rows stay due until marked sent.

## 11. Review submission flow

Reviews are driver-authored, tied to real bookings, and publicly readable per listing.

```mermaid
sequenceDiagram
  autonumber
  participant D as Driver
  participant A as API — /api/reviews
  participant DB as Postgres
  participant V as Visitors — public

  D->>A: POST /reviews — booking id, rating, text
  Note over A: requireAuth · blocked-list check ·<br/>per-user write rate limit
  A->>DB: verify the booking belongs to this driver<br/>and is in a reviewable state
  A->>DB: INSERT review
  A-->>D: review published
  V->>A: GET /reviews/listing/:id — public, read-rate-limited
  A->>DB: fetch reviews + aggregate rating
  A-->>V: reviews shown on listing detail
```

**Reading notes**

- Eligibility is enforced in SQL (ownership in the `WHERE` clause), consistent with the
  repo-wide rule that ownership checks never happen post-fetch.
- No fabricated social proof anywhere: listing ratings are pure aggregates of real rows.

## 12. Admin moderation & operations

Admin is an API surface (`/api/admin`, `requireAdmin`, separate read/write rate limiters)
consumed from the mobile app's admin screen. Every write lands in `event_log`, which is the
operator's reconstruction tool.

```mermaid
flowchart LR
  admin["Admin<br/>requireAuth + requireAdmin<br/>read / write rate limiters"]

  subgraph moderation["Moderation"]
    direction TB
    musers["users — GET · PATCH · DELETE<br/>suspend / manage / delete"]
    mlist["listings — GET · PATCH<br/>moderate / pause"]
  end

  subgraph financial["Financial operations"]
    direction TB
    fbook["bookings — GET · PATCH<br/>dispute resolution · refunds"]
    fpay["payments · payouts — GET"]
    frun["payouts/run — POST<br/>manual Connect transfer sweep"]
  end

  subgraph platform["Platform operations"]
    direction TB
    psupport["support tickets — triage · resolve"]
    psettings["settings · promo codes"]
    pevents["event_log — audit trail"]
    pdash["dashboard — GET"]
  end

  stripe2["Stripe<br/>refunds · transfers"]
  pg2[("Postgres")]

  admin --> moderation
  admin --> financial
  admin --> platform
  musers --> pg2
  mlist --> pg2
  fbook -->|"REFUND — idempotent key"| stripe2
  fbook --> pg2
  frun -->|"TRANSFERS.CREATE"| stripe2
  fpay --> pg2
  psupport --> pg2
  psettings --> pg2
  pevents --> pg2
  pdash --> pg2
  moderation -.->|"every write → insertEventLog"| pevents
  financial -.->|"every write → insertEventLog"| pevents

  classDef client fill:#DBEAFE,stroke:#1D4ED8,color:#1E3A8A
  classDef app fill:#DCFCE7,stroke:#15803D,color:#14532D
  classDef ext fill:#EDE9FE,stroke:#6D28D9,color:#4C1D95
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  class admin client
  class musers,mlist,fbook,fpay,frun,psupport,psettings,pevents,pdash app
  class stripe2 ext
  class pg2 data
  style moderation fill:#F0FDF4,stroke:#15803D,stroke-dasharray:6 4
  style financial fill:#FDF2F8,stroke:#BE185D,stroke-dasharray:6 4
  style platform fill:#F8FAFC,stroke:#475569,stroke-dasharray:6 4
```

**Reading notes**

- Known debt, deliberately drawn as-is: moderated/paused listings are still searchable, and
  account deletion currently hard-deletes financial records. Both are tracked launch items,
  not design intent.
- "Delete" for listings means `status = 'archived'` — moderation never destroys rows.

---

*Generated 2026-07-10 from the live codebase. Companion rendered version: see the
"FreeSpace System Architecture" artifact. When the system changes, update the Mermaid source
here — GitHub renders it directly.*

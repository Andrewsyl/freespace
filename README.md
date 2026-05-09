# FreeSpace

Peer-to-peer parking marketplace. Next.js 15 + Tailwind (`apps/web`), Express + Postgres/PostGIS (`apps/api`), and Expo / React Native (`apps/mobile`) with real Stripe, Google Maps, and host/driver flows.

## Structure
- `apps/web`: Next.js App Router UI (landing, search, host flow, dashboard, admin)
- `apps/api`: Express API with PostGIS search, Stripe payments, JWT auth, support/admin routes
- `apps/mobile`: Expo mobile app for driver + host flows
- `db/migrations`: SQL migrations (PostGIS, bookings, reviews, availability, pricing, admin)

## Getting started
1) Install deps:
```bash
npm install
npm run dev:api   # API on :4000
npm run dev:web   # Web on :3000
```
2) Copy `.env.example` → `.env` and fill values. Ensure Postgres has PostGIS: `CREATE EXTENSION IF NOT EXISTS postgis;`
3) Run migrations in `db/migrations` against `DATABASE_URL` (e.g. `psql "$DATABASE_URL" -f db/migrations/009_admin_core.sql` and others).

### Key env vars
- `WEB_BASE_URL`, `NEXT_PUBLIC_API_BASE`
- `DATABASE_URL` (Postgres + PostGIS)
- `JWT_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- S3 keys if using image upload: `AWS_REGION`, `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## Features
- Search: results + map, respects radius, availability (open/blocked, weekly repeat), advanced filters, URL-persisted filters.
- Listings: detail page with booking selector, map, images, rating display.
- Pricing: hourly + daily listing pricing with backend-backed duration logic.
- Payments: Stripe-backed checkout, saved payment methods, payment history.
- Reviews: drivers can leave 0.5–5 star reviews; listing ratings aggregated.
- Availability: hosts manage open/blocked ranges (including weekly repeat) via API; search excludes blocked ranges and honors opens.
- Host flows: create/edit listing, cover image, street view, pricing, availability, review/publish.
- Account flows: personal info, login/security, vehicle, payments, support, legal.
- Admin: role-gated UI at `/admin` with users, listings, bookings, payments, payouts, support, settings. Admin APIs under `/api/admin`.

## Admin access
- Promote a user to admin in DB: `UPDATE users SET role='admin' WHERE lower(email)='you@example.com';`
- Login as that user; admin UI at `/admin`. Admin API requires JWT with role=admin (fallbacks to DB lookup).

## API outline (selected)
- `GET /api/listings/search` params: `lat,lng,radiusKm,from,to` + optional filters (priceMin/Max, coveredParking, evCharging, securityLevel, vehicleSize, instantBook). Respects availability blocks/opens.
- `POST /api/listings` (auth host) create listing; `GET /api/listings/:id` fetch detail.
- `POST /api/bookings` create booking and validate pricing server-side.
- `POST /api/reviews` leave review (after booking ends); `GET /api/reviews/listing/:id`.
- Admin: `GET/PATCH /api/admin/users/:id`, `GET/PATCH /api/admin/listings/:id`.
- Host availability: `GET/POST /api/host/listings/:id/availability`, `PATCH/DELETE /api/host/availability/:availabilityId`.

## Notes
- Tokens include role; admin middleware also DB-checks role for older tokens.
- Hydration-safe date formatting uses fixed locale/timeZone where needed.
- Map requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Mobile production builds must use a live Stripe publishable key before public launch.

## Mobile app (React Native / Expo)
- Location: `apps/mobile`. Uses Expo + React Navigation with AsyncStorage-backed auth.
- Features: login/signup, search map/list, listing detail, booking confirmation, favorites, history, host listing flow, account pages, and payments.
- Config: set `EXPO_PUBLIC_API_BASE` and platform keys via `apps/mobile/.env.<env>` or `apps/mobile/eas.json`. Shares the same API contract as web.
- Run from repo root: `npm install` then `npm run dev:mobile` (or `cd apps/mobile && npm start`) and choose iOS/Android/web in Expo.
- Notes: local Android device testing can use `adb reverse tcp:4000 tcp:4000`. Release builds are managed through EAS profiles (`development`, `qa`, `preview`, `production`).

## Deployment
- API deploys to AWS ECS Fargate behind `https://api.freespace.ie`.
- Web deployment is verified in CI and deployed separately from the main branch.
- Mobile release builds use EAS.
- See [DEPLOYMENT.md](DEPLOYMENT.md) and [docs/deploy/ecs-fargate-api.md](docs/deploy/ecs-fargate-api.md).

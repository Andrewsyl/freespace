# Deployment Guide

This repo is set up for:
- API + Web on Render
- Mobile test builds via EAS

## 1) Database (Neon / Postgres with PostGIS)

1. Create a Postgres database.
2. Enable PostGIS:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
3. Save the connection string as `DATABASE_URL`.

## 2) Run migrations (from your machine)

From repo root:
```bash
export DATABASE_URL='YOUR_DATABASE_URL'
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f" || break; done
```

## 3) Render deploy (Blueprint)

1. Push this repo to GitHub.
2. In Render, create a **Blueprint** and point it to this repo.
3. Render reads `render.yaml` and creates:
   - `carpark-api`
   - `carpark-web`
4. Fill all env vars marked `sync: false` in Render.

### Required API env vars
- `DATABASE_URL`
- `JWT_SECRET`
- `WEB_BASE_URL` (your deployed web URL)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Important flag
- Keep `STRIPE_CONNECT_ENABLED=false` unless your Stripe account has Connect enabled.

## 4) Verify API

After deploy:
```bash
curl https://YOUR_API_URL/health
```
Expected:
```json
{"ok":true}
```

## 5) Mobile staging setup

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set:
- `EXPO_PUBLIC_API_BASE=https://YOUR_API_URL`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...`

## Environment file templates

Use these templates to keep local vs production separate:
- API local: `apps/api/.env.local.example`
- API production: `apps/api/.env.production.example`
- Mobile local: `apps/mobile/.env.local.example`
- Mobile production: `apps/mobile/.env.production.example`

## 6) EAS test build (internal distribution)

From `apps/mobile`:
```bash
npx eas login
npx eas init
npx eas build --platform android --profile preview
```

Install the APK from the EAS build link and test on device.

## 7) Production mobile build

When staging is good:
```bash
npx eas build --platform android --profile production
```

Optionally submit to store:
```bash
npx eas submit --platform android --profile production
```

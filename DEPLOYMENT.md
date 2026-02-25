# Deployment Guide

This repo supports `local`, `dev`, `qa`, and `production` environments.

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

## 5) Mobile environment setup

Create one env file per target in `apps/mobile`:

- `.env.local` (local API)
- `.env.dev` (shared cloud dev API)
- `.env.qa` (staging/QA API)
- `.env.production` (live API)

Start from templates:

```bash
cp apps/mobile/.env.local.example apps/mobile/.env.local
cp apps/mobile/.env.dev.example apps/mobile/.env.dev
cp apps/mobile/.env.qa.example apps/mobile/.env.qa
cp apps/mobile/.env.production.example apps/mobile/.env.production
```

`apps/mobile/app.config.js` now reads `APP_ENV` and loads `.env.<APP_ENV>`.
Mobile npm scripts also disable Expo auto dotenv loading, so `.env.local` no longer overrides `dev/qa/production`.

Examples:

```bash
# Local Android emulator -> local API
cd apps/mobile && npm run android:local

# Local iOS simulator -> local API
cd apps/mobile && npm run ios:local
```

For real Android devices on local backend, use your LAN IP in `.env.local` (not `10.0.2.2`).

## 6) API environment setup

Use separate env vars and separate infrastructure for each cloud target:

- `dev`: separate Beanstalk env, DB, bucket
- `qa`: separate Beanstalk env, DB, bucket
- `production`: separate Beanstalk env, DB, bucket

Templates:

- `apps/api/.env.local.example`
- `apps/api/.env.dev.example`
- `apps/api/.env.qa.example`
- `apps/api/.env.production.example`

On Elastic Beanstalk, set these as **Environment properties** (do not rely on files).

## 7) EAS build profiles

`apps/mobile/eas.json` is mapped as:

- `development` -> `APP_ENV=dev`
- `qa` -> `APP_ENV=qa`
- `preview` -> `APP_ENV=qa`
- `production` -> `APP_ENV=production`

Build commands:

```bash
cd apps/mobile
npx eas build --platform android --profile qa
npx eas build --platform android --profile production
```

## 8) Legacy quick setup (single env)

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set:
- `EXPO_PUBLIC_API_BASE=https://YOUR_API_URL`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...`

## 9) EAS test build (internal distribution)

From `apps/mobile`:
```bash
npx eas login
npx eas init
npx eas build --platform android --profile preview
```

Install the APK from the EAS build link and test on device.

## 10) Production mobile build

When staging is good:
```bash
npx eas build --platform android --profile production
```

Optionally submit to store:
```bash
npx eas submit --platform android --profile production
```

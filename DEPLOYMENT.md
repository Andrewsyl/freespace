# Deployment Guide

This repo supports `local`, `dev`, `qa`, and `production`.

Current production shape:
- API: AWS ECS Fargate behind `https://api.freespace.ie`
- Web: deployed separately from the main branch after build verification
- Mobile: Expo / EAS builds for Android and iOS

## 1. Database

Use Postgres with PostGIS enabled:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Set `DATABASE_URL` for the target environment.

## 2. Run Migrations

From repo root:

```bash
export DATABASE_URL='YOUR_DATABASE_URL'
for f in db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f" || break
done
```

For production ECS usage, prefer the one-off task flow documented in:

- [docs/deploy/ecs-fargate-api.md](docs/deploy/ecs-fargate-api.md)

## 3. API Deployment (AWS ECS Fargate)

Production API deploys are handled by GitHub Actions:

- workflow: `.github/workflows/deploy-api.yml`
- cluster: `freespace-prod`
- service: `freespace-api-v2`
- hostname: `https://api.freespace.ie`

The workflow:
- builds the API Docker image
- pushes to ECR
- updates the ECS task definition
- deploys the new revision
- runs post-deploy smoke checks

For infrastructure details, secrets, rollback, and one-off migration commands, use:

- [docs/deploy/ecs-fargate-api.md](docs/deploy/ecs-fargate-api.md)

## 4. Required API Environment Variables

At minimum:
- `DATABASE_URL`
- `JWT_SECRET`
- `WEB_BASE_URL`
- `ENFORCE_HTTPS=true` in production
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Optional but recommended:
- `SENTRY_DSN`
- `ERROR_REPORT_WEBHOOK_URL`
- email / support provider secrets you actively use

## 5. Verify API

After deployment:

```bash
curl https://api.freespace.ie/health
npm run smoke:post-deploy
```

Current smoke checks verify:
- `/health`
- API root
- listing search
- listing detail from search results
- expected `401` on unauthenticated auth/booking routes

## 6. Web Deployment

Web deployment is verified in CI and deployed separately from the main branch.

CI currently:
- installs dependencies
- builds the Next.js app with production-like env vars

Before public launch, also verify live web routes manually:
- `/`
- `/login`
- `/legal`
- `/contact`

## 7. Mobile Environment Setup

Per-environment files live in `apps/mobile`:
- `.env.local`
- `.env.dev`
- `.env.qa`
- `.env.production`

Examples:

```bash
cp apps/mobile/.env.local.example apps/mobile/.env.local
cp apps/mobile/.env.dev.example apps/mobile/.env.dev
cp apps/mobile/.env.qa.example apps/mobile/.env.qa
cp apps/mobile/.env.production.example apps/mobile/.env.production
```

`apps/mobile/app.config.js` reads `APP_ENV` and loads `.env.<APP_ENV>`.

## 8. Mobile EAS Profiles

`apps/mobile/eas.json` maps:
- `development` -> `APP_ENV=dev`
- `qa` -> `APP_ENV=qa`
- `preview` -> `APP_ENV=qa`
- `production` -> `APP_ENV=production`

Typical commands:

```bash
cd apps/mobile
npx eas build --platform android --profile qa
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

Important:
- production mobile must use a live Stripe publishable key before public launch
- release screenshots and builds must not show dev badges or debug UI

## 9. Local Mobile Testing

Examples:

```bash
cd apps/mobile && npm run android:local
cd apps/mobile && npm run ios:local
```

For a real Android device against local API:

```bash
adb reverse tcp:4000 tcp:4000
```

If `adb reverse` is unreliable, use your LAN IP instead.

## 10. Release Checklist

Before public launch:
- run migrations in the live DB
- verify production Stripe keys are in live mode
- run Android and iOS release candidates on real devices
- validate booking, payment, refund, and payout onboarding flows
- capture final store screenshots
- rerun post-deploy smoke checks after the final release deploy

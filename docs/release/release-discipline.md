# Release Discipline

## Production release rule
Do not treat `git push main` as the release decision.

Release only when:
- CI is green
- web e2e is green
- mobile smoke has been run on a device
- the rollback target is known
- release notes are prepared

## Minimum release checklist

### Before release
- Confirm latest CI run is green.
- Confirm API smoke checks pass locally or in staging.
- Run:
  - `yarn test:api`
  - `yarn test:web:e2e`
  - `yarn test:mobile`
  - `yarn typecheck:mobile`
- Run mobile Maestro flows on a device:
  - `npm --workspace apps/mobile run test:e2e:guest`
  - `npm --workspace apps/mobile run test:e2e:booking`
  - `npm --workspace apps/mobile run test:e2e:host`
- Confirm Stripe mode matches environment.
- Confirm Google Maps / OAuth keys match target environment.
- Confirm the rollback SHA/image tag.

### After release
- Check:
  - API `/health`
  - homepage
  - search
  - listing page
  - login
  - booking start
  - host publish
- Watch:
  - ECS deploy stabilization
  - Sentry / client error reports
  - event logs for `booking_confirmed`, `listing_published`, `*_failed`

## Mobile rollout discipline
- iOS: keep latest build in TestFlight first, validate on internal testers, then expand.
- Android: use staged rollout rather than 100% release immediately.

Suggested rollout ladder:
- 5%
- 20%
- 50%
- 100%

Stop rollout immediately if:
- login failures rise
- booking failures rise
- crashes spike
- map/search goes blank

## Web rollout discipline
- Web publishing must run through `.github/workflows/deploy-web.yml`.
- A web release is not complete until `verify:web:live` confirms the live site is serving the pushed commit SHA.
- Prefer merging only after the release checklist is complete.
- If a risky UI or booking change is involved, release during a staffed window with rollback ready.

### Web deploy contract
- Build marker source order:
  - `NEXT_PUBLIC_APP_BUILD_SHA`
  - `AWS_COMMIT_ID`
  - `VERCEL_GIT_COMMIT_SHA`
  - `GITHUB_SHA`
- Production pages expose the marker on `<body data-build-sha="...">`.
- The deploy workflow:
  - builds and pushes the `freespace-web` image to ECR
  - updates the `freespace-web` ECS service task definition
  - waits for the live site to serve the expected SHA
  - runs web smoke checks against production

If the SHA never appears live, treat the release as failed even if ECS reported the service as stable.

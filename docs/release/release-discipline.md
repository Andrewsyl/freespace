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
- Amplify deploys from `main`, so treat every merge as production-sensitive.
- Prefer merging only after the release checklist is complete.
- If a risky UI or booking change is involved, release during a staffed window with rollback ready.

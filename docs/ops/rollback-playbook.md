# Rollback Playbook

## API rollback target
- ECS service: `freespace-api-v2`
- Cluster: `freespace-prod`
- Image repository: `freespace-api`

## Fast rollback path
1. Open GitHub Actions.
2. Run `Roll Back API`.
3. Enter the known-good image tag or commit SHA.
4. Wait for ECS stabilization.
5. Confirm:
   - `https://api.freespace.ie/health`
   - booking search
   - listing detail
   - auth login

## How to find the last good image
- Use the last green `Deploy API and Web` run.
- The API image tag is the Git commit SHA used by that deployment.

## Web rollback
Web is deployed by Amplify.

Rollback path:
1. Open the Amplify app.
2. Select the last healthy deployment for `main`.
3. Redeploy that version.
4. Verify:
   - homepage
   - search page
   - listing page
   - login/signup

## Mobile rollback
- iOS: stop release propagation in App Store Connect / keep previous TestFlight build active.
- Android: halt staged rollout in Play Console or promote previous production artifact.

## Five-minute rollback rule
If any of these fail after a release, roll back immediately:
- login/signup
- search returns spaces
- listing page loads
- booking start fails for multiple users
- host publish or payout flow is broken

# Amplify Web Migration

This repo is ready for `apps/web` to move from Elastic Beanstalk to AWS Amplify Hosting.

## What is already prepared

- `amplify.yml` at the repo root
- API base already available at:
  - `https://api.freespace.ie`

## Amplify app settings

- App type: `Next.js`
- Platform: `WEB_COMPUTE`
- Repository:
  - `https://github.com/Andrewsyl/carpark`
- Branch:
  - `main`

## Required environment variables

- `NEXT_PUBLIC_API_BASE=https://api.freespace.ie`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...`
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=...`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`
- `NEXT_PUBLIC_MAPBOX_TOKEN=...`

## Build

Amplify should use the repo-root `amplify.yml`.

## Domain cutover

After the Amplify branch is live:

1. Attach:
   - `freespace.ie`
   - `www.freespace.ie`
2. Verify the deployed site works against:
   - `https://api.freespace.ie`
3. Terminate:
   - `FreeSpace-env-webb`

## Why this was not created automatically

Creating a new Amplify app from GitHub requires a GitHub access token or connection during `create-app`.
This AWS account currently has:

- no existing Amplify apps
- no CodeStar/GitHub connections

So the repo is prepared, but the actual Amplify app creation must be completed with GitHub authorization.

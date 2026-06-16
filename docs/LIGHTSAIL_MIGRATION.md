# FreeSpace — Lightsail Consolidation Plan

Goal: cut the always-on AWS bill from **~$42/mo** (post Spot+Graviton) to **~$13–27/mo**
by replacing the ECS + ALB + public-IPv4 stack with a **single AWS Lightsail instance**
running the existing containers behind Caddy (auto TLS). Everything stays on AWS.

## Why this saves money

| Component (today) | ~Monthly | Fate |
|---|---|---|
| ALB (`freespace-api-alb`) | ~$15 | **deleted** — one box needs no load balancer |
| Public IPv4 ×3 | ~$15 | **deleted** — Lightsail static IP is free while attached |
| Fargate Spot (api + web) | ~$8 | **deleted** — containers move to the box |
| RDS `t4g.micro` | ~$11.5 | **keep** (Option A) or **move onto box** (Option B) |
| ECR + Route53 + SES + S3 | ~$3 | keep (cheap, pay-per-use) |
| **Lightsail instance** (new) | +$12 | 2 GB RAM / 2 vCPU / 60 GB SSD, static IP + 3 TB transfer incl. |

**DECISION: Option A — keep RDS** (~$27/mo). Managed DB, automated backups + PITR, lowest
risk, and the database is already where it belongs when traffic grows (resize/split the box,
never touch the DB). Box-Postgres (~$15/mo) was rejected: cheap now, but it puts bookings/payment
data on a shared single-point-of-failure box and forces a second migration once there are real users.

> **IAM note:** On ECS the *task role* provided the API's AWS permissions (S3 uploads bucket
> `freespace-uploads-530726524685-eu-west-1`, SES). Lightsail has no instance role, so create a
> dedicated IAM user with least-privilege S3 (that bucket) + SES send, and put its access key in
> the box `.env` (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). Same key (with `ecr:*` pull) also
> authenticates `docker pull` from ECR.

## Current topology (confirmed)

- One ALB host-routes 3 names → 2 ECS services (both listen `:8080`, health `/health`):
  - `freespace.ie`, `www.freespace.ie` → `freespace-web` (Next.js standalone)
  - `api.freespace.ie` → `freespace-api-v2` (Node) — **the mobile app's endpoint; must not break**
- DB: RDS `freespace-db`, Postgres **17.9 with PostGIS**, private, SG `sg-09e98e89b3df08b83`, secret `freespace/api-iHluTi` (`DATABASE_URL`, `JWT_SECRET`, Stripe, Resend, SMTP…).
- Images already in **ECR** — the box pulls the *same* images; the existing build/push pipeline is unchanged.
- Web image **bakes `NEXT_PUBLIC_API_BASE=https://api.freespace.ie` at build** → unchanged, so the current web image works as-is.

## Target architecture

```
Route53 (freespace.ie, www, api)  ──A──▶  Lightsail static IP
                                              │
                                   ┌──────────┴───────────┐
                                   │   Lightsail instance   │
                                   │  Caddy (:443, auto TLS)│
                                   │   ├─ freespace.ie/www ─▶ web   container :8080
                                   │   └─ api.freespace.ie ─▶ api   container :8080
                                   │   (Option B: + postgis container :5432)
                                   └────────────────────────┘
                                              │ (Option A: VPC peering)
                                          RDS freespace-db
```

Caddy gets free Let's Encrypt certs for all three names → the ACM cert + its DNS-validation
records become unnecessary (leave them or clean up later).

## Prerequisites

- Lightsail instance, Ubuntu 22.04, **$12 plan (2 GB)**, region **eu-west-1**, static IP attached.
- Docker + docker-compose-plugin installed on it.
- The box can auth to ECR (`aws ecr get-login-password` via an IAM user/role with `ecr:GetAuthorizationToken` + pull).
- **Option A only:** enable Lightsail ↔ default-VPC **peering** (one click in Lightsail console, eu-west-1), and add the Lightsail private range to RDS SG `sg-09e98e89b3df08b83` on 5432.

## Steps (each reversible; near-zero downtime via parallel run + DNS cutover)

### 1. Stand up the box (no DNS change yet)
1. Create the Lightsail instance + static IP; install Docker.
2. Copy a `compose.prod.yml` (Caddy + web + api [+ postgis for Option B]) and a locked-down `.env`
   (the secret values from `freespace/api-iHluTi`).
3. `aws ecr get-login-password | docker login …` then `docker compose pull`.

### 2. Database
- **Option A (keep RDS):** enable VPC peering, open SG to Lightsail range, set `DATABASE_URL` to the RDS endpoint.
- **Option B (box Postgres):** run `postgis/postgis:17-*`; `pg_dump` RDS → restore into the box DB (brief temp public access on RDS, IP-locked, reverted after — see Neon runbook pattern).

### 3. Bring it up + run migrations
1. `docker compose up -d`
2. `docker compose exec api npm --workspace apps/api run migrate:dist`
3. Test **before DNS** via `curl --resolve` against the static IP:
   - `curl --resolve api.freespace.ie:443:<IP> https://api.freespace.ie/health`
   - `curl --resolve freespace.ie:443:<IP> https://freespace.ie/`

### 4. Cut over DNS (Route53 zone `Z0244626LY6L8OZNN3L5`)
- Lower TTLs to 60s a few hours beforehand.
- Point `freespace.ie` (A), `www.freespace.ie` (A), `api.freespace.ie` (→ A) at the static IP
  (replace the current ALB aliases/CNAME).
- Watch: mobile app hits `api.freespace.ie` → should resolve to the box; verify a real booking flow.

### 5. Decommission AWS (only after 2–3 days stable)
- ECS: scale both services to 0, then delete services + `freespace-prod` cluster.
- Delete ALB `freespace-api-alb` + its target groups → **stops ALB + IPv4 charges**.
- Release any now-unused Elastic IPs.
- Option B: after a fallback window, delete RDS `freespace-db` (final snapshot first).
- Optional: prune ECR, remove ACM cert + validation CNAMEs.

## Rollback
DNS still has the ALB targets in history — repoint the 3 records back to
`freespace-api-alb-1466268762.eu-west-1.elb.amazonaws.com` and the old ECS/ALB
path is live again (keep ECS at desired=1 until cutover is proven).

## Operational notes (the cost of "cheap")
- **Backups:** Option B needs a cron `pg_dump` → S3 (Option A keeps RDS automated backups).
- **Patching/uptime:** one box = single point of failure; fine pre-launch, revisit at scale.
- **Deploys:** build/push to ECR (unchanged) → on box `docker compose pull && up -d` (script over SSH).

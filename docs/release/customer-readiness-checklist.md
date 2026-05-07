# Customer Readiness Checklist

Use this as the pre-customer gate for FreeSpace.

Status meanings:

- `built`: the code path or surface exists
- `verified`: covered by stronger evidence such as tests or repeated successful manual checks
- `needs QA`: present but still needs real device or end-to-end validation
- `blocker`: not safe to treat as customer-ready yet

## Driver Flows

| Flow | Status | Evidence / Notes |
| --- | --- | --- |
| Sign up | built, verified, needs QA | Mobile and web surfaces exist; API auth tests exist; still needs real-device and real-email verification. |
| Sign in | built, verified, needs QA | Mobile test exists; API auth tests exist; still needs production-like QA. |
| Password reset | built, needs QA | Surface exists on mobile and web; needs live email flow verification. |
| Search results | built, verified, needs QA | Mobile search test exists; listing search is in post-deploy smoke; needs real map/device QA. |
| Listing detail | built, needs QA | Strongly implemented on mobile and web; still undergoing polish and needs final layout/device pass. |
| Booking confirmation | built, verified, needs QA | Mobile test exists; current screen is actively being refined; needs end-to-end booking verification. |
| Booking success | built, needs QA | Web success route and mobile booking flow exist; needs live validation. |
| Booking detail | built, needs QA | Surface exists with cancel/extend logic; needs real booking lifecycle QA. |
| Booking history | built, needs QA | Surface exists; needs state validation across upcoming, active, completed, canceled, refunded. |
| Favorites | built, needs QA | Surface and API route exist; needs manual verification. |

## Payments And Refunds

| Flow | Status | Evidence / Notes |
| --- | --- | --- |
| Add card / save payment method | built, blocker | Surface and API exist, but Stripe confidence is still too weak to call customer-ready without live validation. |
| Booking payment | built, blocker | PaymentSheet path exists on mobile and checkout exists on web; must be proven with real test transactions in target env. |
| Failed payment handling | built, needs QA | Code path exists; needs explicit unhappy-path QA. |
| Driver cancellation | built, verified, needs QA | Refund/cancel backend logic is substantial and has tests; still needs live verification. |
| Host cancellation | built, verified, needs QA | Backend logic exists; must be tested with real booking records. |
| Refund processing | built, verified, needs QA | API refund tests exist; needs live Stripe/admin confirmation. |
| Orphan payment handling | built, verified | Covered in API tests; lower UI risk but still monitor in production. |

## Host Flows

| Flow | Status | Evidence / Notes |
| --- | --- | --- |
| Create listing | built, needs QA | Mobile create/listing flow exists; needs full submission QA. |
| Edit listing | built, needs QA | Surface exists; needs regression QA around saved edits and images. |
| Listing photos upload | built, needs QA | Flow exists; needs permission and upload validation on devices. |
| Listing location / map flow | built, needs QA | Flow exists; needs device and permission QA. |
| Availability setup | built, needs QA | Flow exists; needs validation for edge cases and persistence. |
| Listing review / publish | built, needs QA | Flow exists; needs final host happy-path validation. |
| Host dashboard / listings | built, needs QA | Surface exists on mobile and web; needs realistic account validation. |
| Host payout onboarding | built, blocker | Stripe onboarding path exists, but must be proven live before outreach. |
| Host payout history / earnings | built, needs QA | Surfaces exist; depends on payout readiness and seeded data. |

## Notifications

| Flow | Status | Evidence / Notes |
| --- | --- | --- |
| Push permission prompt | built, needs QA | App requests permissions; needs iOS and Android confirmation. |
| Expo token registration | built, needs QA | Code path exists; must be verified against live backend. |
| Booking reminder scheduling | built, needs QA | Local scheduling exists in booking flow; needs real-device timing checks. |
| Host booking notifications | built, needs QA | Server-side processing exists; needs end-to-end delivery validation. |
| Booking status update notifications | built, needs QA | Implementation exists; needs live delivery QA. |

## Admin And Support

| Flow | Status | Evidence / Notes |
| --- | --- | --- |
| Admin login / access | built, needs QA | Admin web surfaces exist; needs role and access-path validation. |
| User moderation | built, needs QA | API and UI exist; needs real admin walkthrough. |
| Listing moderation | built, needs QA | API and UI exist; must be tested against real pending listings. |
| Booking management | built, needs QA | API and UI exist; needs refund/cancel/admin override walkthrough. |
| Payments admin view | built, needs QA | Surface exists; verify data integrity. |
| Support tickets | built, needs QA | Route and screens exist; needs real ticket lifecycle test. |
| Fraud settings / admin settings | built, needs QA | UI and backend exist; needs careful settings audit. |

## Operations

| Flow | Status | Evidence / Notes |
| --- | --- | --- |
| API deploy to AWS | built, verified | Workflow and docs exist; user confirmed AWS is working. |
| Web deploy | built, needs QA | Build verification exists; final production rollout path should be checked end to end. |
| Mobile release build | built, needs QA | EAS lane setup exists; no hard proof in repo that final RC builds have been validated. |
| Environment sanity checks | verified | Scripts exist and CI runs them. |
| Migration sanity checks | verified | Naming checks exist; runtime startup also checks for missing migrations. |
| Post-deploy smoke checks | built, needs improvement | Script exists but is too shallow for launch confidence. |
| Release notes / metadata / permissions copy | built | Docs exist; actual store submission assets still need to be produced. |
| App screenshots | blocker | Checklist exists, but screenshots still need to be captured manually. |
| Rollback plan | built | Deployment docs cover rollback at infra level. |
| Chargeback / dispute playbook | built | Playbook exists. |
| Payout automation | blocker | Explicit TODO remains; decide whether manual ops is acceptable for launch. |

## Immediate Launch Blockers

- Saved-card and live payment flow not yet treated as fully proven
- Host payout onboarding not yet treated as fully proven
- Payout automation still incomplete unless manual ops is formally accepted
- Final app-store / play-store screenshots not yet produced
- Smoke checks are too shallow to serve as the only production gate

## Sign-Off Gate

Do not approach customers until all of these are true:

- Every `blocker` row is cleared or explicitly accepted with an owner and workaround
- Every `needs QA` row has been manually tested in a production-like environment
- One release candidate has been run end to end on real devices
- Payments, refunds, notifications, and host payout onboarding have all been verified live

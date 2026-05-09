# Public Launch Checklist

Target: public Android + iOS launch within 2 weeks.

Status:
- `[done]` complete
- `[must fix]` blocker before launch
- `[must verify]` built, but needs proof
- `[can wait]` acceptable after launch if consciously deferred

## 1. Hard Blockers

| Item | Status | What to do |
| --- | --- | --- |
| Production mobile Stripe key is still `pk_test_...` in `apps/mobile/eas.json` | `[must fix]` | Replace with the correct `pk_live_...` key and rebuild. |
| iOS release/TestFlight build not yet proven | `[must fix]` | Build and install on real iPhone devices. |
| Live payment flow not yet proven end to end | `[must fix]` | Test booking, charge success, failed charge, and refund. |
| Host payout onboarding not yet proven live | `[must fix]` | Complete a real onboarding test. |
| App Store / Play Store screenshots not finished | `[must fix]` | Capture final production-looking screenshots. |
| Final release runbook not written | `[must fix]` | Document deploy order, QA steps, rollback, owners. |

## 2. Already Done

| Item | Status | Notes |
| --- | --- | --- |
| AWS API deployment path works | `[done]` | User confirmed AWS deploy is in place. |
| Android build exists | `[done]` | Base Android release path is working. |
| DB migration `034_listing_rate_type.sql` applied | `[done]` | `rate_type` and `price_per_hour` now exist in `listings`. |
| CI baseline exists | `[done]` | API build/tests, mobile typecheck/tests, web lint/build. |
| Release docs exist | `[done]` | Metadata, permissions copy, screenshot checklist are in repo. |
| Customer readiness checklist exists | `[done]` | `docs/release/customer-readiness-checklist.md` |

## 3. Payments

| Flow | Status | What to prove |
| --- | --- | --- |
| Saved cards on Android | `[must verify]` | Add card, reuse card, remove card, default card. |
| Saved cards on iOS | `[must fix]` | Same as Android, on real iPhone/TestFlight build. |
| Successful payment | `[must fix]` | Booking creates correct Stripe/payment state and app state. |
| Failed payment | `[must verify]` | Decline path is clear and recoverable. |
| Refund flow | `[must fix]` | Cancel/refund updates both app state and Stripe state. |
| Payout onboarding | `[must fix]` | Host can complete onboarding without dead ends. |
| Manual payout process | `[must verify]` | If payouts are not automated, document owner + procedure. |

## 4. Mobile Release

| Item | Status | What to do |
| --- | --- | --- |
| Android release candidate tested on real devices | `[must verify]` | Full booking/payment/account flow. |
| iOS release candidate tested on real devices | `[must fix]` | Full booking/payment/account flow. |
| Push permission prompt behaves correctly | `[must verify]` | Fresh install on both platforms. |
| Push token registration works | `[must verify]` | Confirm backend receives and uses tokens. |
| No dev badges / debug UI in release builds | `[must fix]` | Especially for screenshots and store builds. |
| Icons, splash, versioning, package IDs finalized | `[must verify]` | Final pre-submission review. |

## 5. Driver QA

| Flow | Status | What to prove |
| --- | --- | --- |
| Sign up | `[must verify]` | Real email/account creation works. |
| Sign in | `[must verify]` | Release build login works. |
| Password reset | `[must verify]` | Email reset works end to end. |
| Search | `[must verify]` | Map/list, filters, pricing, availability. |
| Listing page | `[must verify]` | Final layout and booking entry points. |
| Booking confirmation | `[must verify]` | Correct time, price, vehicle, payment state. |
| Booking success | `[must verify]` | User reaches success and booking is persisted. |
| History / booking detail | `[must verify]` | Upcoming, active, completed, canceled states. |
| Favorites | `[must verify]` | Save/unsave stays consistent. |

## 6. Host QA

| Flow | Status | What to prove |
| --- | --- | --- |
| Create listing | `[must verify]` | End-to-end listing creation and publish. |
| Edit listing | `[must verify]` | Persistence is correct and stable. |
| Photo upload | `[must verify]` | Permissions and upload behavior on real devices. |
| Location / cover image flow | `[must verify]` | No clipped content, no broken map/image states. |
| Pricing flow | `[must verify]` | Hourly/daily logic behaves correctly. |
| Availability flow | `[must verify]` | Day/time states save correctly. |
| Final review/publish | `[must verify]` | Submission completes without backend issues. |

## 7. Account / Support QA

| Flow | Status | What to prove |
| --- | --- | --- |
| Personal information | `[must verify]` | Save, verify email, verify phone. |
| Login & security | `[must verify]` | Password change, logout, delete-account entry points. |
| Payments page | `[must verify]` | Cards/history render and actions work. |
| Vehicle page | `[must verify]` | Save/update works and persists. |
| Support contact flow | `[must verify]` | Submission reaches support backend. |
| Legal pages | `[must verify]` | Correct content and live URLs. |

## 8. Admin / Ops

| Item | Status | What to do |
| --- | --- | --- |
| Admin access works in production | `[must verify]` | Confirm permissions and visibility. |
| Listing moderation works | `[must verify]` | Review actual pending listings. |
| Booking/payment visibility works | `[must verify]` | Confirm useful ops visibility. |
| Support/admin flow works | `[must verify]` | End-to-end handling path. |
| Chargeback / dispute playbook reviewed | `[must verify]` | Make sure launch-day operator knows it. |

## 9. Store Submission

| Item | Status | What to do |
| --- | --- | --- |
| App Store metadata finalized | `[must verify]` | Based on `docs/release/app-store-metadata.md`. |
| Play Store metadata finalized | `[must verify]` | Same source of truth. |
| Permissions copy finalized | `[must verify]` | Based on `docs/release/mobile-permissions-copy.md`. |
| App Store screenshots captured | `[must fix]` | Real release-quality screenshots only. |
| Play Store screenshots captured | `[must fix]` | Real release-quality screenshots only. |
| Review notes prepared | `[must verify]` | Include test account guidance if needed. |

## 10. Monitoring / Smoke

| Item | Status | What to do |
| --- | --- | --- |
| Basic API smoke passes | `[must verify]` | Re-run after final release-candidate deploy. |
| Authenticated smoke exists | `[must fix]` | Current smoke is too shallow. |
| Booking smoke exists | `[must fix]` | Add at least one happy-path check. |
| Payment smoke/preflight exists | `[must fix]` | Verify infrastructure assumptions before launch. |
| Error monitoring checked | `[must verify]` | Confirm visibility into crashes and server errors. |

## 11. Docs Cleanup

| Item | Status | What to do |
| --- | --- | --- |
| README reflects reality | `[must fix]` | Remove stale Render / Stripe stub references. |
| DEPLOYMENT docs reflect AWS setup | `[must fix]` | Align with the actual live environment. |
| One release-day runbook exists | `[must fix]` | Owners, order, rollback, support contacts. |

## 12. Final Go / No-Go

Launch only if all of these are true:

- production mobile uses live Stripe config
- Android and iOS release builds both pass real-device QA
- booking, payment, refund, and payout onboarding have been tested live
- store screenshots and metadata are complete
- smoke checks go beyond `/health`
- launch-day support owner is identified
- rollback plan is written down

## 13. Two-Week Plan

### This Week

- switch production mobile Stripe key to live
- finish iOS release build and real-device install
- run migration verification in production
- test live payment, failed payment, refund, payout onboarding
- update README and DEPLOYMENT docs
- add deeper smoke checks

### Next Week

- run full Android + iOS regression
- capture App Store and Play Store screenshots
- finalize metadata and permissions copy
- do final release-candidate deploy
- rerun smoke tests
- submit to App Store and Play Store


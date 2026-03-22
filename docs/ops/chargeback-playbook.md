# Chargeback Playbook

This is the minimum operational process for FreeSpace chargebacks and payment disputes.

## Scope

Use this playbook when:

- Stripe notifies us of a dispute or chargeback
- a driver claims they were charged incorrectly
- a host disputes a cancellation or refund outcome

## Evidence to gather

For every disputed booking, collect:

- booking ID
- payment intent ID
- refund ID, if any
- checkout session ID, if any
- driver email and user ID
- host email and user ID
- listing ID and listing title
- booking start/end timestamps in UTC
- booking status timeline from `event_log`
- booking instructions shown to the driver
- receipt URL
- refund status and refunded timestamp
- support ticket or complaint text

## First response SLA

- Acknowledge the dispute within 1 business day
- Confirm whether the case is:
  - duplicate charge
  - non-delivery / could not park
  - canceled booking
  - fraudulent card use
  - host-side access issue

## Internal triage

1. Check whether the booking exists and whether payment succeeded.
2. Check whether the booking was canceled or refunded already.
3. Check for booking conflicts, host cancellation, or access/arrival instruction gaps.
4. Check whether the same payment intent has already been refunded.
5. If the driver paid but no valid booking remained, refund immediately if not already refunded.

## Decision rules

### Refund immediately

Refund without escalation when:

- payment succeeded but no valid booking record exists
- booking was double-charged
- the host canceled and no alternative space was accepted
- the driver could not access the booked space due to incorrect or missing entry instructions

### Escalate for review

Escalate when:

- the host disputes the driver's access issue claim
- there is evidence of driver misuse, no-show, or overstay
- the payment appears fraudulent
- the requested refund conflicts with the published cancellation policy

## Stripe handling

- Use Stripe dispute tooling for formal chargebacks
- Preserve:
  - receipt URL
  - booking timestamps
  - listing address
  - arrival/entry instructions
  - event log timeline
- Never create multiple refunds for the same payment intent

## Customer communication

Driver-facing reply should include:

- current booking/refund status
- whether refund is being processed
- expected timing for funds to appear
- support contact for follow-up

Host-facing reply should include:

- booking ID
- dispute reason
- whether payout is affected or on hold

## Follow-up actions

- add an audit/event-log entry for the dispute outcome
- update the support ticket
- identify whether the case exposes a product gap:
  - poor arrival instructions
  - host cancellation handling
  - booking conflict race
  - refund automation gap

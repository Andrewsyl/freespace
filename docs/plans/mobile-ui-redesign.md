Goal
- Modernize the mobile listing, booking summary, booking detail, and history screens so they feel more premium, trustworthy, and conversion-focused without changing functionality.

Non-goals
- No backend changes.
- No navigation or flow changes.
- No behavior changes to booking, payment, history, or host actions.

Constraints
- Preserve existing data and interaction logic.
- Use the app's existing design tokens and component patterns where possible.
- Keep touch targets accessible and layouts responsive on small phones.

Acceptance criteria
- Screens have clearer hierarchy, consistent spacing, and more polished card/button treatment.
- Booking summary and detail screens feel easier to scan and less visually dense.
- History cards and empty/loading states feel more refined and consistent.
- No functionality regressions.

Approach
- Audit current mobile screen structure and identify repetitive or high-friction sections.
- Introduce reusable spacing and section styles inside the affected screens/components.
- Tighten typography scale, card padding, and primary CTA emphasis.
- Reduce visual clutter by simplifying secondary text and aligning icon usage.

Files / areas affected
- apps/mobile/screens/ListingScreen.tsx
- apps/mobile/screens/BookingSummaryScreen.tsx
- apps/mobile/screens/BookingDetailScreen.tsx
- apps/mobile/screens/HistoryScreen.tsx
- apps/mobile/components/BookingCard.tsx
- apps/mobile/components/Button.tsx (if needed)

Verification plan
- Typecheck the mobile app after edits.
- Review the changed screens for layout regressions and overflow.

Test plan
- Open the affected screens and confirm the primary action, booking summary, booking detail, and history states still render and navigate correctly.

Monitoring plan
- Watch for clipped content, wrapped CTAs, or unreadable metadata on narrow devices.

Risks / open questions
- Some screens are large and bespoke; reuse will be limited.
- Copy density may need iterative adjustment after a visual pass.

Status
- complete

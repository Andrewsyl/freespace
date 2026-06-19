Goal
- Redesign the mobile search filter experience so it feels modern, premium, and fast to use while preserving the existing search capabilities.

Non-goals
- No backend changes.
- No changes to how listings are fetched or ranked.
- No removal of supported filter values.

Constraints
- Preserve the current filter state model and search params.
- Keep the experience mobile-first and accessibility-friendly.
- Prefer progressive disclosure over dense settings-style layouts.
- Keep touch targets large enough for thumbs.

Acceptance criteria
- The filter panel feels like a modern bottom sheet rather than a settings screen.
- The most important filters are surfaced first: price, distance context, parking type, instant booking, and trust/security.
- Secondary options are accessible without increasing cognitive load.
- The panel supports quick decisions with fewer taps and less scrolling.
- Search behavior remains unchanged.

Approach
- Rebuild the filter panel around a compact summary header, quick filter chips, and a smaller set of grouped sections.
- Replace the switch-heavy section with chip-based toggles where that reduces friction.
- Keep advanced values available, but hide them behind a clearer budget section and compact control rows.
- Reuse the existing search param mapping so the functionality stays intact.
- Follow current mobile marketplace patterns: sectioned modal sheets, pill filters, high-priority popular filters, and sticky result actions.
- Use a two-handle price range slider with a lightweight histogram, matching modern travel marketplace filter patterns.

Files / areas affected
- apps/mobile/screens/SearchScreen.tsx

Verification plan
- Typecheck the mobile app after the UI changes.
- Manually review the filter sheet layout and interactions on a narrow mobile viewport.

Test plan
- Open the filter sheet, toggle each control, apply filters, and confirm search results still update.
- Confirm filters persist after reopening the sheet.

Monitoring plan
- Watch for overflow, clipped chips, and cramped rows on smaller phones.

Risks / open questions
- The filter set is already small; the main risk is over-compressing it and making advanced filters harder to discover.

Status
- complete

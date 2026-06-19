## Goal
Standardize the mobile app iconography on Lucide icons so the UI feels cohesive, premium, and production-ready.

## Non-goals
Redesign screen layouts, change flows, create custom icon artwork, or alter business logic.

## Constraints
Use Lucide first. Do not generate custom SVGs or mix decorative icon styles. Preserve existing functionality and avoid touching unrelated dirty files unless needed for icon replacement.

## Acceptance Criteria
Remaining mobile UI icons use Lucide where practical. Replaced icons are semantically accurate, consistently sized, and visually aligned. TypeScript passes for the mobile app.

## Approach
Audit `Ionicons` usage across mobile screens/components, map each purpose to a Lucide icon, provide the replacement table, then patch files in small groups.

## Files / Areas Affected
`apps/mobile/screens/*`, `apps/mobile/components/*`, and related mobile UI helpers that currently import `@expo/vector-icons`.

## Verification Plan
Run mobile TypeScript after changes and inspect remaining `Ionicons` imports to confirm only intentionally retained cases remain, if any.

## Test Plan
Typecheck validates imports/props. Search output validates the icon migration. Visual QA remains manual in simulator/device because this is a presentation-layer refactor.

## Monitoring Plan
If a Lucide icon name is unavailable or causes a type error, swap to the closest available Lucide equivalent rather than adding another library.

## Risks / Open Questions
Some screens may have many preexisting uncommitted changes. Keep edits targeted to imports and icon JSX to avoid merging unrelated work.

## Status
Completed. Mobile UI screens/components now standardize on Lucide; only the Jest test setup keeps a legacy vector-icon mock for compatibility.

Goal
- Bring the remaining high-traffic mobile screens in line with the new premium FreeSpace visual language.

Non-goals
- No functional or navigation changes.
- No backend or data changes.

Constraints
- Preserve existing flows and labels where possible.
- Keep changes consistent with the mobile design tokens and the updated marketplace screens.
- Maintain accessibility and touch target sizes.

Acceptance criteria
- Welcome, auth, profile, settings, favorites, personal info, payments, and support screens feel visually consistent.
- Cards, rows, form fields, and empty states follow a clearer hierarchy and spacing rhythm.
- No regressions in sign-in or account management flows.

Approach
- Normalize page headers and card radii/padding across the screens.
- Tighten form field density and modal/sheet presentation.
- Improve the logged-out states and empty states so they feel intentional rather than placeholder-like.

Files / areas affected
- apps/mobile/screens/WelcomeScreen.tsx
- apps/mobile/screens/SignInScreen.tsx
- apps/mobile/screens/RegisterScreen.tsx
- apps/mobile/screens/ProfileScreen.tsx
- apps/mobile/screens/SettingsScreen.tsx
- apps/mobile/screens/FavoritesScreen.tsx
- apps/mobile/screens/PersonalInfoScreen.tsx
- apps/mobile/screens/PaymentsScreen.tsx
- apps/mobile/screens/SupportScreen.tsx

Verification plan
- Typecheck the mobile app after edits.
- Review the affected screens for spacing, truncation, and touch target issues.

Test plan
- Open each updated screen and confirm the primary actions, rows, empty states, and modals render correctly.

Monitoring plan
- Watch for text overflow and clipping on narrow phones.

Risks / open questions
- Some screens use bespoke layouts and may need follow-up polish after the first pass.

Status
- complete

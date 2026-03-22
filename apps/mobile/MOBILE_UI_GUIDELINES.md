# Mobile UI Standard

This app should use the `ListingScreen` visual language as the reference system.

## Core Rules

1. Typography
- Use `Poppins` for page titles, card titles, section headers, and buttons.
- Use `Inter` for body copy, metadata, form text, helper text, and list rows.
- Use `textStyles` from `apps/mobile/styles/theme.ts`.

2. Spacing
- Use `spacing.screenX` for horizontal page padding.
- Use `spacing.screenY` for vertical page start spacing.
- Use `spacing.card` for card padding.
- Use `spacing.gap` / `spacing.sm` / `spacing.md` for internal rhythm.

3. Surfaces
- Default page background: `colors.appBg`
- Default card: `surfaces.card`
- Muted card: `surfaces.cardMuted`
- Avoid creating ad hoc card radii, borders, or shadows per screen.

4. Forms
- Use `fields` from `apps/mobile/styles/theme.ts`.
- Text inputs should use the same:
  - border color
  - focus treatment
  - padding
  - text style
- Avoid one-off form styling inside screens unless the input is a special branded control.

5. Buttons
- Use the shared button variants from `buttons` in `apps/mobile/styles/theme.ts`.
- Primary CTAs should use the accent fill.
- Secondary actions should use white with border.

6. Section hierarchy
- Page title: `textStyles.screenTitle`
- Major card title: `textStyles.title` or `textStyles.titleSmall`
- Section title: `textStyles.sectionTitle`
- Body text: `textStyles.body`
- Meta/supporting text: `textStyles.meta`

## Shared primitives

Use the primitives under `apps/mobile/components/ui/`:

- `Screen`
- `Card`
- `SectionHeader`
- `TextInput`
- `Button`

If a new screen needs custom layout, compose from these primitives first before creating new styles.

## Anti-patterns

Do not:
- import from `apps/mobile/theme/*` for new mobile UI
- create new color literals when an existing token exists
- create screen-specific typography scales
- create new shadows or border radii ad hoc

## Migration rule

When updating a screen:
1. Replace ad hoc titles/body/meta styles with `textStyles`
2. Replace surface styles with `surfaces`
3. Replace form controls with shared field styles or `components/ui/TextInput`
4. Replace direct CTA styling with `components/ui/Button` or `buttons`

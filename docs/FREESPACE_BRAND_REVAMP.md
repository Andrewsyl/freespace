# FreeSpace Brand Revamp — execution spec

**Status:** approved by maintainer 2026-07-07. This is a build order, not a mood board.
**Supersedes:** `docs/PARKING_DESIGN_BIBLE.md` Part E11 (the "never import marketing energy
into product screens" rule is revoked — see §4 for the new two-register map) and the
"Profile screens = white background" rule in `AGENTS.md` (Profile flips to cream with the
rest of the app). Everything else in the bible still stands, especially E1–E10, E12, and
all of Part D.

---

## 0. Contract with the executing agent — read first

The previous pass at this brief failed by being timid: token values were nudged, screens
stayed structurally identical, and the app still read as bland grey-white with a mid-green
sprinkled on. **That outcome is a failure even if every checklist item passes.**

Hard rules for this work:

1. **The squint test is the acceptance test.** After each phase, a before/after screenshot
   pair of the touched screens must be distinguishable at arm's length. If a screen's only
   change is a background hex and a font weight, the phase is not done.
2. **Every "brand moment" screen (§4 list) must contain at least two of:** a flooded
   deep-green panel, a lowercase display headline, a doodle motif (§3.4), or the amber
   accent. Zero of these = failed screen.
3. **Do not invent restraint.** Where this spec says "flooded green panel", build a flooded
   green panel — not a white card with a green border. Where it says "lowercase headline",
   the string is lowercase in the source, not `textTransform` on an existing title.
4. **Do not touch behavior.** This is a visual/copy revamp. No API changes, no pricing
   logic, no navigation restructure, no new data fetching. Map behavior guardrails in
   `AGENTS.md` all stand (no auto-search, no pin hearts, pins unchanged).
5. Work phase by phase (§6). After each phase: `npm run typecheck:mobile`, then one clean
   simulator pass of the touched screens (single pass, not exploratory).

---

## 1. The identity

FreeSpace is **the friendly local shortcut** — the neighbour who says "ah sure, park in
mine." Warm, Irish, a bit cheeky, completely dependable about money and access. Premium
comes from confidence (deep color used generously, big type, real photos), not from
minimalist grey restraint.

Personality pillars:

- **Warm ground.** Cream, not grey-white. The whole app sits on warmth.
- **Deep green, used like it means it.** The dark end of the existing brand ramp
  (`brand[800]` `#0b5237`, `brand[900]` `#0a4230`) becomes the workhorse: CTAs, prices,
  active tab, flooded panels. The mid-green `#0a8050` retreats to live-status and pins.
- **One warm accent.** A single amber/mustard for scarcity pills and one highlighted word
  on brand panels. Nothing else gets a warm color.
- **A hand of its own.** A small line-art doodle set (§3.4) — a looping route that ends in
  a parking dot, a spark/asterisk star — used on brand moments and empty states. This is
  the "FreeSpace recognisable" device.
- **A voice.** Lowercase, conversational, Irish-adjacent, short (§5). "you're parked."
  not "Booking Confirmed".

What FreeSpace is **not**: gamified (no confetti, badges, streaks), urgent-fake (no
countdowns, no invented scarcity), corporate (no "Listing #4821", no ALL-CAPS system
titles outside the existing hero style).

---

## 2. Token changes (Phase 1) — exact edits

All in `apps/mobile/designTokens.ts` + `apps/mobile/styles/theme.ts`. No other file
defines a color.

### 2.1 New cream surface family

```ts
// designTokens.ts — color.surface changes
surface: {
  page: "#FAF6EC",        // was #FAFBFB — warm cream, the app-wide page ground
  app: "#FAF6EC",         // was #FFFFFF — Screen default bg is now cream
  card: "#FFFFFF",        // unchanged — cards stay pure white ON cream
  muted: "#F3EDDF",       // was #EDEFEF — muted surfaces go warm, not grey
  subtle: "#FAF6EC",
  accent: "#E9F4EC",      // soft green tint for category/amenity tiles (was #edf7f2 — a notch more visible)
  brandPanel: "#0a4230",  // NEW — flooded brand panel ground (= brand[900])
  overlayLight: "rgba(255, 251, 242, 0.95)",  // warm-tinted near-opaque for map chrome
  overlayDark: "rgba(10, 66, 48, 0.55)",      // scrims go deep green, not black
  splash: "#0a4230",      // splash joins the deep register
},
```

### 2.2 Deep-green role reassignment

```ts
// theme.ts — colors changes
primary: color.brand[800],        // was brand[600] — CTAs, active states go deep
headerTint: color.brand[900],
accent: color.brand[600],         // mid-green demoted to live-status/secondary accents
price: color.brand[800],          // NEW named role — all price text uses this, not ink
onBrandPanel: "#FAF6EC",          // NEW — text/icons on flooded panels (cream, not pure white)
onBrandPanelSoft: "rgba(250, 246, 236, 0.72)", // NEW — secondary text on panels
```

- `buttons.primary.backgroundColor` → `colors.primary` (deep green). Height stays 52,
  radius stays 14. `primaryButtonShadow.shadowColor` → `#0a4230`.
- Tab bar: active tint `brand[800]`, inactive `text.soft`, bar background
  `surface.page` (cream) with a hairline top border `border.subtle`.
- Map price pins, live "available now" status: **unchanged** (`brand[600]` family).
  The approved v30 pins are not touched.

### 2.3 The amber accent

```ts
// designTokens.ts — add to color.accent
pop: "#F5B73B",       // scarcity pills, one highlighted word on brand panels — nothing else
popInk: "#3D2E08",    // text on amber
```

Scarcity pill spec (replaces bible E7's `status.warning` suggestion): small pill,
`accent.pop` fill, `popInk` ExtraBold 13px text, image top-left, only when remaining
capacity ≤ 2 and real. Absent by default.

### 2.4 Warm borders

`border.subtle` → `#EDE5D4`, `border.default` → `#D9D0BC` (grey hairlines look dirty on
cream). `border.field` follows `default`. Keep `border.strong` grey-green for control
outlines on white cards.

### 2.5 Ink stays ink

`colors.text` (`#101414`) remains the only ink (bible E12 stands). Price is the one
exception: price text uses `colors.price` (deep green) everywhere — card, detail, summary.
This is the TGTG value cue, promoted from E6's "revisit later" to policy.

---

## 3. New type + brand primitives (Phase 1)

### 3.1 Display textStyles — add to `theme.ts`

```ts
brandHero: {
  // lowercase display for brand moments — "you're parked."
  color: colors.onBrandPanel,     // cream; override to brandDark on cream grounds
  fontSize: 40, lineHeight: 44,
  fontFamily: "PlusJakartaSans-ExtraBold", fontWeight: "800",
  letterSpacing: -1.0,
},
brandKicker: {
  // the small warm line above/below a hero — amber on panels
  color: color.accent.pop,
  fontSize: 16, lineHeight: 22,
  fontFamily: "PlusJakartaSans-Bold", fontWeight: "700",
  letterSpacing: 0.4, textTransform: "lowercase",
},
```

`displayHero` (uppercase 46) is retired from new use — brand moments are lowercase.
Existing uses migrate to `brandHero` as their screens are touched.

### 3.2 `components/brand/BrandPanel.tsx`

Flooded panel: `surface.brandPanel` bg, `radius.xl` (24), padding `spacing.xl`,
children get `onBrandPanel` text color context. Optional `doodle` prop renders a §3.4
doodle absolutely positioned (top-right or bottom-left, 20% opacity mint). Optional
`fullBleed` variant with no radius/margins for screen-top heroes (confirmation,
onboarding).

### 3.3 `components/brand/EmptyState.tsx`

One shared empty state for the whole app: doodle (48–64px, `brand[700]` stroke on cream),
lowercase headline (`titleSmall` sized, ink), one-line sub (`subtitle`), optional ghost
CTA. Replaces every per-screen empty state as screens are touched. Copy per screen in §5.

### 3.4 `components/brand/doodles.tsx`

`react-native-svg` line-art set, single 2.5px rounded stroke, one color prop:

- **`RouteDoodle`** — a loose looping path that ends in a filled dot (a journey ending in
  a parking spot). The primary motif.
- **`SparkDoodle`** — 4-point hand-drawn star/asterisk (TGTG-style spark).
- **`SmileDoodle`** — tiny arc smile, used sparingly on success moments.

These are drawn once as fixed SVG paths — no animation, no randomness. They appear only
on: brand panels, empty states, onboarding, confirmation. Never on transactional surfaces
(checkout, forms) or over the map.

### 3.5 Amenity/category tiles — `components/brand/CategoryTile.tsx`

The TGTG "what you'll get" signature (reference images 2/3): `surface.accent` soft-green
rounded tile (`radius.lg`), line-art icon in `brand[800]` (use existing icon set at
28–32px until custom line-art exists), short Bold label, 2-column grid. Used for listing
amenities (§6.5) and "how it works" content.

---

## 4. The two registers — which screens are loud

**Brand register (loud — panels, doodles, lowercase heroes, amber):**

- Booking confirmation (the success moment in `BookingSummaryScreen`)
- Empty states everywhere (History, Favorites, Listings, search-no-results)
- `OnboardingPermissionsScreen` + auth/welcome surfaces
- Profile header block (name + member-since on a brand treatment)
- Host "first listing" / zero-state surfaces

**Product register (calm — cream ground, white cards, deep-green price/CTA, no doodles):**

- Search/map (map guardrails absolute; chrome goes warm-opaque per §2.1 overlayLight)
- Listing detail (white content zone, one hero, tinted amenity tiles are the personality)
- Booking summary/payment above the success moment (E9 anatomy stands: terms → CTA → marks)
- Booking detail / access code (calm, but the access code block is allowed one BrandPanel —
  "you're in" is a brand moment inside a transactional screen)
- Host management screens (higher density budget stands; cream ground, no doodles)

The registers share the same palette and type — loud is a *dosage* difference, not a
different design system.

---

## 5. Voice — copy rules and strings

Rules: lowercase for brand-register headlines (in the source string, full stop included).
Sentence case for everything transactional. Short. No exclamation marks except at most
one on the confirmation screen. Never fake ("no fabricated stats" stands absolutely).
Money, legal, errors: plain sentence case, zero personality — never joke near a charge.

| Surface | Copy |
|---|---|
| Confirmation hero | `you're parked.` + kicker `nice one` |
| Confirmation sub | `Everything you need is below — address, access, the lot.` |
| History empty | `nowhere you've been — yet.` sub: `Your bookings will land here.` |
| Favorites empty | `no favourites saved.` sub: `Tap the heart on a space you'd come back to.` |
| Search no results | `nothing in this patch.` sub: `Try widening the map or nudging your times.` |
| Host zero listings | `your driveway could be earning.` sub: `List a space in a few minutes.` |
| Onboarding location | `find spaces near you.` sub: `We only use your location while you're searching.` |
| Access code panel | `you're in.` above the code |
| Profile greeting | `howya, {firstName}.` (first name only; fall back to `howya.`) |

`howya` is deliberate — if it tests wrong with users it's one string to change, but it is
the single most FreeSpace-recognisable word in the app. Ship it.

---

## 6. Screen-by-screen build order

Each phase is one PR-sized unit. Definition of done (DoD) per screen is the acceptance
list — all items, not a sample.

### Phase 1 — Tokens + primitives (no screen work)
Files: `designTokens.ts`, `styles/theme.ts`, `components/brand/*` (new), tab navigator,
`components/ui/Screen.tsx`.
**DoD:** app-wide cream ground visible on every screen with zero screen edits; primary
buttons deep green everywhere; tab bar cream with deep-green active state; typecheck
clean; brand components render in a scratch screen. Expect broad-but-shallow visual
change here — Phases 2–5 add the structure.

### Phase 2 — Brand moments
Screens: `BookingSummaryScreen` (success overlay → full-bleed BrandPanel hero:
`you're parked.` + SparkDoodle + snapshot card below on cream), `HistoryScreen` +
`FavoritesScreen` (EmptyState kit + card rails per Phase 4 card spec if trivial, else
defer cards), `OnboardingPermissionsScreen` (flooded green screen, cream text,
RouteDoodle, lowercase hero), Profile header (`howya, {name}.` greeting block; list rows
stay icon-list style, now on cream).
**DoD:** each screen passes rule §0.2 (two+ brand devices); confirmation shows address +
access snapshot within the first viewport below the hero; no behavior change; empty
states all use the shared component.

### Phase 3 — Discovery chrome
Screens: `SearchScreen`, `MapBottomCard`.
Map itself and pins untouched. Floating search card + filter chips → warm near-opaque
(`overlayLight`), deep-green icons/text. `MapBottomCard`: price → `colors.price` deep
green ExtraBold right-aligned (E6 three-lever loudness), scarcity amber pill on image
top-left when real capacity ≤ 2, title/meta zone per bible E1 two-zone discipline.
**DoD:** every floating control ≥92% opaque; exactly one shadow class over the map at a
time; price is unmistakably the loudest card element; squint-test vs. before shows warm
chrome, green price, amber pill.

### Phase 4 — Listing cards + detail
Screens: `ListingsScreen` (driver-facing rails if present), `ListingScreen`,
`FavoritesScreen`/`HistoryScreen` cards if deferred from Phase 2.
Card spec: white card on cream, `radius.cardSmall` (18), image 16:10 bleeding to card
clip, scarcity pill top-left, heart top-right on image (cards may have hearts; pins never),
text zone = title 16 SemiBold / meta 13 muted / **price deep-green ExtraBold 20–22
right-aligned** with per-hour unit in meta grey.
`ListingScreen`: white content zone on cream ground; amenities → `CategoryTile` 2-col
grid (this is the page's personality moment); host trust block per bible E10.1 (real
facts only); sticky bottom CTA deep green with price at left.
**DoD:** amenity tiles present and tinted; price louder than title on every card; zero
local color constants left in touched files; host block shows only computed facts.

### Phase 5 — Booking flow + access
Screens: `BookingSummaryScreen` (pre-payment section), `BookingDetailScreen`,
`HostBookingDetailScreen`, `VehicleTypeScreen`.
Summary: E9 anatomy (terms tiny → full-width deep CTA → payment marks); totals in
`colors.price`. BookingDetail: access code inside a BrandPanel — `you're in.` kicker,
code in cream 32px ExtraBold monospaced-spacing, arrival instructions below in the panel's
soft text. Host screens: cream + tokens, calm register, no doodles.
**DoD:** terms→CTA→marks order intact; access panel passes squint test; no personality
copy within the payment step itself.

### Phase 6 — Sweep
Remaining screens (auth, editors, settings sheets) to cream + token discipline. Kill every
remaining local hex/radius (bible §0 debt list). Update `MOBILE_UI_GUIDELINES.md` to point
here.
**DoD:** `grep -rn "#[0-9a-fA-F]\{6\}" apps/mobile/screens apps/mobile/components` returns
only files that import from theme (shadow colors excepted per E12); one visual pass of the
full app reads as one product.

---

## 7. What still stands (do not relitigate)

- All `AGENTS.md` invariants and map guardrails; pins are approved and untouched.
- Honest loading (skeletons mirror layout — restyle skeleton fills to a warm tint
  `#F0E9DA` so they don't flash grey on cream).
- No fabricated stats/urgency anywhere, including brand-register copy.
- Bible Parts A–D and E1–E10/E12 except where §2/§4 above explicitly override
  (page ground, price color, profile background, E11 register rule).
- Price loudness hierarchy; one amber max per card; one hero shadow per screen.
- `enableFreeze` refresh-param pattern; no focus effects.

## 8. Global definition of done

- [ ] Cream ground on every screen; no `#FAFBFB`/`#FFFFFF` page backgrounds remain
- [ ] Primary CTA, active tab, price text all in the deep-green register
- [ ] Amber appears only as scarcity pills + one highlighted word on brand panels
- [ ] Every brand-moment screen carries ≥2 brand devices (§0.2)
- [ ] All empty states use `components/brand/EmptyState`
- [ ] Doodles appear on brand moments only — never on map, forms, or payment
- [ ] Voice table (§5) strings shipped verbatim
- [ ] `npm run typecheck:mobile` clean; one simulator pass per phase
- [ ] Before/after screenshots attached per phase and pass the squint test
